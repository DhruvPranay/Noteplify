from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth -------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Lectures ---------------------------------------------------------------
class YouTubeIn(BaseModel):
    url: str = Field(min_length=8, max_length=500)
    title: str | None = Field(default=None, max_length=300)


class LectureUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=300)


class MetricOut(ORMModel):
    audio_duration_s: float
    download_s: float
    preprocess_s: float
    transcribe_s: float
    index_s: float
    generate_s: float
    total_s: float
    rtf: float | None
    minutes_per_audio_hour: float | None
    transcribe_backend: str
    asr_model: str
    llm_model: str
    embedding_model: str
    num_audio_chunks: int
    num_rag_chunks: int
    wer: float | None
    wer_details: dict | None


class LectureListItem(ORMModel):
    id: int
    title: str
    source_type: str
    youtube_id: str | None
    status: str
    stage: str | None
    progress: float
    error: str | None
    duration_s: float | None
    summary: str | None
    created_at: datetime


class LectureOut(LectureListItem):
    source_url: str | None
    original_filename: str | None
    has_audio: bool
    language: str | None
    notes_markdown: str | None
    key_takeaways: list | None
    sections: list | None
    flashcard_count: int
    metric: MetricOut | None
    updated_at: datetime


class SegmentOut(ORMModel):
    idx: int
    start: float
    end: float
    text: str


class FlashcardOut(ORMModel):
    id: int
    idx: int
    question: str
    answer: str


class MediaTokenOut(BaseModel):
    token: str
    expires_in: int


# --- Q&A / search -----------------------------------------------------------
class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class SourceOut(BaseModel):
    chunk_id: int
    lecture_id: int
    lecture_title: str
    start: float
    end: float
    text: str
    score: float


class QAOut(ORMModel):
    id: int
    question: str
    answer: str
    sources: list[SourceOut]
    created_at: datetime


class SearchOut(BaseModel):
    query: str
    hits: list[SourceOut]


# --- Metrics ----------------------------------------------------------------
class WerIn(BaseModel):
    reference: str = Field(min_length=1, max_length=2_000_000)


class WerOut(BaseModel):
    wer: float
    substitutions: int
    deletions: int
    insertions: int
    hits: int
    reference_words: int
    hypothesis_words: int


class RunOut(BaseModel):
    lecture_id: int
    title: str
    audio_minutes: float
    total_s: float
    minutes_per_audio_hour: float | None
    rtf: float | None
    wer: float | None
    transcribe_backend: str
    asr_model: str
    created_at: datetime


class MetricsSummary(BaseModel):
    lectures_total: int
    lectures_completed: int
    lectures_failed: int
    audio_hours: float
    processing_hours: float
    avg_minutes_per_audio_hour: float | None
    avg_rtf: float | None
    avg_wer: float | None
    wer_samples: int
    stage_share: dict[str, float]
    runs: list[RunOut]


class HealthOut(BaseModel):
    status: str
    app: str
    mock_ai: bool
    transcribe_backend: str
    asr_model: str
    llm_model: str
    embedding_model: str
    hf_configured: bool
