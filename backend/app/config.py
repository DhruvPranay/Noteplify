from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (or a .env file)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Noteplify"
    environment: str = "development"

    # --- Database -----------------------------------------------------------
    database_url: str = "postgresql+psycopg://noteplify:noteplify@localhost:5432/noteplify"

    # --- Auth ---------------------------------------------------------------
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Comma-separated list of allowed browser origins ("*" allows any).
    cors_origins: str = "http://localhost:5173"

    # --- Hugging Face -------------------------------------------------------
    hf_token: str | None = None
    hf_provider: str = "auto"  # "auto", "hf-inference", "fal-ai", "together", ...
    hf_timeout: float = 180.0
    asr_model: str = "openai/whisper-large-v3"
    llm_model: str = "meta-llama/Llama-3.1-8B-Instruct"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384

    # Simulated AI (no Hugging Face calls). Handy for local UI development & demos.
    mock_ai: bool = False

    # --- Free / offline alternatives (see README "Local AI mode") ------------------
    embedding_backend: str = "hf"  # "hf" | "local" (fastembed: ONNX MiniLM on CPU)
    llm_backend: str = "hf"  # "hf" | "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    llm_timeout: float = 600.0

    # --- Transcription ------------------------------------------------------
    transcribe_backend: str = "hf"  # "hf" (Inference API) or "local" (faster-whisper)
    local_whisper_size: str = "small"
    local_whisper_device: str = "cpu"  # "cuda" needs CUDA 12 + cuDNN 9 installed
    chunk_seconds: float = 30.0  # Whisper's native window
    chunk_search_window: float = 10.0  # look back this far for a silence to cut on
    asr_concurrency: int = 4

    # --- Notes / RAG --------------------------------------------------------
    section_words: int = 1500
    llm_concurrency: int = 3
    rag_chunk_words: int = 160
    rag_chunk_overlap: int = 40
    rag_top_k: int = 5

    # --- Jobs & files -------------------------------------------------------
    max_concurrent_jobs: int = 2
    upload_dir: str = "./data/uploads"
    max_upload_mb: int = 500
    max_audio_minutes: int = 180
    ytdlp_cookies_file: str | None = None

    # When this folder exists, the API also serves the built React app.
    frontend_dist: str = "../frontend/dist"

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        v = v.strip().strip('"').strip("'")
        if not v:
            raise ValueError("DATABASE_URL is empty: paste your PostgreSQL connection string into backend/.env")
        # Render / Heroku / Neon hand out postgres:// URLs; SQLAlchemy needs the driver name.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    # Human-readable names of the models actually in use (for metrics & /api/health).
    @property
    def effective_asr_model(self) -> str:
        if self.mock_ai:
            return "mock-whisper"
        return f"faster-whisper-{self.local_whisper_size}" if self.transcribe_backend == "local" else self.asr_model

    @property
    def effective_llm_model(self) -> str:
        if self.mock_ai:
            return "mock-llm"
        return f"ollama/{self.ollama_model}" if self.llm_backend == "ollama" else self.llm_model

    @property
    def effective_embedding_model(self) -> str:
        if self.mock_ai:
            return "hashing-mock"
        return f"fastembed/{self.embedding_model}" if self.embedding_backend == "local" else self.embedding_model

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
