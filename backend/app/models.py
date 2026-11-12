from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.db import Base

EMBED_DIM = get_settings().embedding_dim


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    lectures: Mapped[list[Lecture]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class Lecture(Base):
    __tablename__ = "lectures"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    source_type: Mapped[str] = mapped_column(String(20))  # "upload" | "youtube"
    source_url: Mapped[str | None] = mapped_column(Text)
    youtube_id: Mapped[str | None] = mapped_column(String(32))
    file_path: Mapped[str | None] = mapped_column(Text)
    original_filename: Mapped[str | None] = mapped_column(String(300))

    # queued -> processing -> completed | failed ; `stage` is the step inside "processing"
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    stage: Mapped[str | None] = mapped_column(String(40), default="queued")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text)

    duration_s: Mapped[float | None] = mapped_column(Float)
    language: Mapped[str | None] = mapped_column(String(16))
    transcript_text: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    notes_markdown: Mapped[str | None] = mapped_column(Text)
    key_takeaways: Mapped[list | None] = mapped_column(JSONB)
    sections: Mapped[list | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="lectures")
    segments: Mapped[list[TranscriptSegment]] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", passive_deletes=True,
        order_by="TranscriptSegment.idx",
    )
    chunks: Mapped[list[Chunk]] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", passive_deletes=True
    )
    flashcards: Mapped[list[Flashcard]] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", passive_deletes=True,
        order_by="Flashcard.idx",
    )
    qa_entries: Mapped[list[QAEntry]] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", passive_deletes=True,
        order_by="QAEntry.created_at",
    )
    metric: Mapped[ProcessingMetric | None] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", passive_deletes=True, uselist=False
    )

    @property
    def has_audio(self) -> bool:
        return self.source_type == "upload" and bool(self.file_path) and Path(self.file_path).is_file()

    @property
    def flashcard_count(self) -> int:
        return len(self.flashcards)


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(ForeignKey("lectures.id", ondelete="CASCADE"), index=True)
    idx: Mapped[int] = mapped_column(Integer)
    start: Mapped[float] = mapped_column("start_s", Float)
    end: Mapped[float] = mapped_column("end_s", Float)
    text: Mapped[str] = mapped_column(Text)

    lecture: Mapped[Lecture] = relationship(back_populates="segments")


class Chunk(Base):
    """A retrieval unit for RAG: ~160 words of transcript with an embedding."""

    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(ForeignKey("lectures.id", ondelete="CASCADE"), index=True)
    idx: Mapped[int] = mapped_column(Integer)
    start: Mapped[float] = mapped_column("start_s", Float)
    end: Mapped[float] = mapped_column("end_s", Float)
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBED_DIM))

    lecture: Mapped[Lecture] = relationship(back_populates="chunks")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(ForeignKey("lectures.id", ondelete="CASCADE"), index=True)
    idx: Mapped[int] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)

    lecture: Mapped[Lecture] = relationship(back_populates="flashcards")


class QAEntry(Base):
    __tablename__ = "qa_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(ForeignKey("lectures.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    lecture: Mapped[Lecture] = relationship(back_populates="qa_entries")


class ProcessingMetric(Base):
    """Per-lecture timing breakdown plus (optional) WER against a reference transcript."""

    __tablename__ = "processing_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(
        ForeignKey("lectures.id", ondelete="CASCADE"), unique=True, index=True
    )
    audio_duration_s: Mapped[float] = mapped_column(Float)
    download_s: Mapped[float] = mapped_column(Float, default=0.0)
    preprocess_s: Mapped[float] = mapped_column(Float, default=0.0)
    transcribe_s: Mapped[float] = mapped_column(Float, default=0.0)
    index_s: Mapped[float] = mapped_column(Float, default=0.0)
    generate_s: Mapped[float] = mapped_column(Float, default=0.0)
    total_s: Mapped[float] = mapped_column(Float, default=0.0)

    transcribe_backend: Mapped[str] = mapped_column(String(20))
    asr_model: Mapped[str] = mapped_column(String(200))
    llm_model: Mapped[str] = mapped_column(String(200))
    embedding_model: Mapped[str] = mapped_column(String(200))
    num_audio_chunks: Mapped[int] = mapped_column(Integer, default=0)
    num_rag_chunks: Mapped[int] = mapped_column(Integer, default=0)

    wer: Mapped[float | None] = mapped_column(Float)
    wer_details: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    lecture: Mapped[Lecture] = relationship(back_populates="metric")

    @property
    def rtf(self) -> float | None:
        """Real-time factor: processing seconds per second of audio (lower is faster)."""
        return self.total_s / self.audio_duration_s if self.audio_duration_s else None

    @property
    def minutes_per_audio_hour(self) -> float | None:
        """Wall-clock minutes needed to process one hour of audio."""
        return self.rtf * 60 if self.rtf is not None else None
