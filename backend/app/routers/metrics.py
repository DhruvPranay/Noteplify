from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lecture, ProcessingMetric, User
from app.schemas import MetricsSummary, RunOut, WerIn, WerOut
from app.security import get_current_user, get_owned_lecture
from app.services.wer import compute_wer

router = APIRouter(tags=["metrics"])
STAGES = ("download", "preprocess", "transcribe", "index", "generate")


@router.post("/lectures/{lecture_id}/wer", response_model=WerOut)
def evaluate_wer(lecture_id: int, body: WerIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Score the Whisper transcript against a human reference transcript."""
    lecture = get_owned_lecture(db, lecture_id, user)
    if lecture.status != "completed" or lecture.metric is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "The lecture must finish processing first")
    try:
        result = compute_wer(body.reference, lecture.transcript_text or "")
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    lecture.metric.wer = result["wer"]
    lecture.metric.wer_details = result
    db.commit()
    return result


@router.get("/metrics/summary", response_model=MetricsSummary)
def metrics_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Lecture.status, func.count()).where(Lecture.user_id == user.id).group_by(Lecture.status)
        ).all()
    )
    rows = db.execute(
        select(ProcessingMetric, Lecture.title)
        .join(Lecture, Lecture.id == ProcessingMetric.lecture_id)
        .where(Lecture.user_id == user.id)
        .order_by(ProcessingMetric.created_at.desc())
    ).all()
    metrics = [m for m, _ in rows]

    audio_s = sum(m.audio_duration_s for m in metrics)
    total_s = sum(m.total_s for m in metrics)
    stage_totals = {st: sum(getattr(m, f"{st}_s") for m in metrics) for st in STAGES}
    stage_sum = sum(stage_totals.values()) or 1.0
    wers = [m.wer for m in metrics if m.wer is not None]
    rtf = total_s / audio_s if audio_s else None

    return MetricsSummary(
        lectures_total=sum(counts.values()),
        lectures_completed=counts.get("completed", 0),
        lectures_failed=counts.get("failed", 0),
        audio_hours=round(audio_s / 3600, 3),
        processing_hours=round(total_s / 3600, 3),
        avg_minutes_per_audio_hour=round(rtf * 60, 2) if rtf is not None else None,
        avg_rtf=round(rtf, 4) if rtf is not None else None,
        avg_wer=round(sum(wers) / len(wers), 4) if wers else None,
        wer_samples=len(wers),
        stage_share={st: round(v / stage_sum, 4) for st, v in stage_totals.items()},
        runs=[
            RunOut(
                lecture_id=m.lecture_id, title=title, audio_minutes=round(m.audio_duration_s / 60, 2),
                total_s=m.total_s, minutes_per_audio_hour=m.minutes_per_audio_hour, rtf=m.rtf, wer=m.wer,
                transcribe_backend=m.transcribe_backend, asr_model=m.asr_model, created_at=m.created_at,
            )
            for m, title in rows[:50]
        ],
    )
