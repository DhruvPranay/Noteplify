"""The lecture processing pipeline and its background job runner.

download -> preprocess (ffmpeg) -> transcribe (Whisper) -> index (embeddings + pgvector)
         -> generate (notes & flashcards) ; every stage is timed for the metrics dashboard.
"""

import logging
import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import Chunk, Flashcard, Lecture, ProcessingMetric, QAEntry, TranscriptSegment
from app.services import audio
from app.services.common import PipelineError, StageTimer
from app.services.embeddings import embed_texts
from app.services.notes import generate_notes
from app.services.rag import build_chunks
from app.services.transcribe import transcribe
from app.services.youtube import PLACEHOLDER_TITLE, download_youtube_audio

log = logging.getLogger(__name__)
settings = get_settings()

_executor = ThreadPoolExecutor(max_workers=max(1, settings.max_concurrent_jobs), thread_name_prefix="job")


def enqueue(lecture_id: int) -> None:
    _executor.submit(_safe_run, lecture_id)


def _safe_run(lecture_id: int) -> None:
    try:
        run_pipeline(lecture_id)
    except Exception:  # noqa: BLE001
        log.exception("Pipeline crashed for lecture %s", lecture_id)


def resume_pending_jobs() -> None:
    """Re-queue work interrupted by a restart or deploy."""
    with SessionLocal() as db:
        lectures = db.scalars(select(Lecture).where(Lecture.status.in_(["queued", "processing"]))).all()
        for lecture in lectures:
            lecture.status, lecture.stage, lecture.progress = "queued", "queued", 0.0
        db.commit()
        ids = [lecture.id for lecture in lectures]
    for lecture_id in ids:
        enqueue(lecture_id)
    if ids:
        log.info("Resumed %d pending lecture(s)", len(ids))


def _update(db: Session, lecture: Lecture, *, stage: str | None = None, progress: float | None = None) -> None:
    if stage:
        lecture.stage = stage
    if progress is not None:
        lecture.progress = round(min(max(progress, 0.0), 1.0), 4)
    db.commit()


def _reset_outputs(db: Session, lecture: Lecture) -> None:
    for model in (TranscriptSegment, Chunk, Flashcard, QAEntry, ProcessingMetric):
        db.execute(delete(model).where(model.lecture_id == lecture.id))
    lecture.status, lecture.error = "processing", None
    lecture.transcript_text = lecture.summary = lecture.notes_markdown = None
    lecture.key_takeaways = lecture.sections = None
    db.commit()
    db.expire(lecture)


def run_pipeline(lecture_id: int) -> None:
    db = SessionLocal()
    workdir = Path(tempfile.mkdtemp(prefix=f"noteplify_{lecture_id}_"))
    try:
        lecture = db.get(Lecture, lecture_id)
        if lecture is None:
            return
        _reset_outputs(db, lecture)
        timer = StageTimer()
        max_seconds = settings.max_audio_minutes * 60

        # 1. Acquire audio --------------------------------------------------------
        _update(db, lecture, stage="downloading", progress=0.02)
        with timer.stage("download"):
            if lecture.source_type == "youtube":
                yt = download_youtube_audio(lecture.source_url or "", workdir, max_seconds)
                source = yt.path
                lecture.youtube_id = yt.video_id
                if lecture.title == PLACEHOLDER_TITLE:
                    lecture.title = yt.title[:300]
            else:
                source = Path(lecture.file_path or "")
                if not source.is_file():
                    raise PipelineError("The uploaded file is no longer on the server — please upload it again.")

        # 2. Preprocess -----------------------------------------------------------
        _update(db, lecture, stage="preprocessing", progress=0.06)
        with timer.stage("preprocess"):
            duration = audio.probe_duration(source)
            if duration < 1:
                raise PipelineError("This recording is empty.")
            if duration > max_seconds:
                raise PipelineError(
                    f"Recording is {duration / 60:.0f} min; the limit is {settings.max_audio_minutes} min."
                )
            wav = audio.normalize_audio(source, workdir / "audio.wav")
        lecture.duration_s = round(duration, 2)

        # 3. Transcribe -----------------------------------------------------------
        _update(db, lecture, stage="transcribing", progress=0.1)
        with timer.stage("transcribe"):
            result = transcribe(wav, workdir, duration,
                                on_progress=lambda f: _update(db, lecture, progress=0.1 + 0.6 * f))
        if not result.segments:
            raise PipelineError("No speech was detected in this recording.")
        db.add_all(
            TranscriptSegment(lecture_id=lecture.id, idx=i, start=seg.start, end=seg.end, text=seg.text)
            for i, seg in enumerate(result.segments)
        )
        lecture.transcript_text = " ".join(seg.text for seg in result.segments)
        lecture.language = result.language

        # 4. Index for RAG --------------------------------------------------------
        _update(db, lecture, stage="indexing", progress=0.72)
        with timer.stage("index"):
            chunks = build_chunks(result.segments, settings.rag_chunk_words, settings.rag_chunk_overlap)
            vectors = embed_texts([c.text for c in chunks])
            db.add_all(
                Chunk(lecture_id=lecture.id, idx=c.idx, start=c.start, end=c.end, text=c.text, embedding=v)
                for c, v in zip(chunks, vectors, strict=True)
            )

        # 5. Notes & flashcards ---------------------------------------------------
        _update(db, lecture, stage="generating", progress=0.8)
        with timer.stage("generate"):
            notes = generate_notes(result.segments, lecture.title,
                                   on_progress=lambda f: _update(db, lecture, progress=0.8 + 0.18 * f))
        db.add_all(
            Flashcard(lecture_id=lecture.id, idx=i, question=c["question"], answer=c["answer"])
            for i, c in enumerate(notes.flashcards)
        )
        lecture.summary = notes.summary
        lecture.key_takeaways = notes.key_takeaways
        lecture.sections = notes.sections
        lecture.notes_markdown = notes.markdown

        db.add(ProcessingMetric(
            lecture_id=lecture.id,
            audio_duration_s=round(duration, 2),
            download_s=timer.get("download"),
            preprocess_s=timer.get("preprocess"),
            transcribe_s=timer.get("transcribe"),
            index_s=timer.get("index"),
            generate_s=timer.get("generate"),
            total_s=timer.total,
            transcribe_backend=result.backend,
            asr_model=result.model,
            llm_model=settings.effective_llm_model,
            embedding_model=settings.effective_embedding_model,
            num_audio_chunks=result.num_chunks,
            num_rag_chunks=len(chunks),
        ))
        lecture.status = "completed"
        _update(db, lecture, stage="completed", progress=1.0)
        log.info("Lecture %s processed: %.0fs audio in %.1fs", lecture_id, duration, timer.total)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        message = str(exc) if isinstance(exc, PipelineError) else f"Unexpected error: {exc}"
        if isinstance(exc, PipelineError):
            log.warning("Lecture %s failed: %s", lecture_id, message)
        else:
            log.exception("Lecture %s failed unexpectedly", lecture_id)
        try:
            lecture = db.get(Lecture, lecture_id)
            if lecture is not None:
                lecture.status, lecture.error = "failed", message[:2000]
                db.commit()
        except Exception:  # noqa: BLE001
            log.exception("Could not record failure for lecture %s", lecture_id)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
        db.close()
