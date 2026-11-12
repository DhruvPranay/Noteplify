import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.pipeline import resume_pending_jobs
from app.routers import auth, lectures, metrics, qa
from app.schemas import HealthOut

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("noteplify")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.jwt_secret == "change-me-in-production" and settings.environment == "production":
        log.warning("JWT_SECRET is using the default value — set a long random secret!")
    uses_hf = "hf" in (settings.transcribe_backend, settings.embedding_backend, settings.llm_backend)
    if not settings.hf_token and not settings.mock_ai and uses_hf:
        log.warning("HF_TOKEN is not set: processing will fail until it is (or set MOCK_AI=true).")
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    init_db()
    resume_pending_jobs()
    yield


app = FastAPI(
    title="Noteplify API",
    version="1.0.0",
    description="Lecture recordings → transcripts, structured notes, flashcards and RAG Q&A.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,  # auth uses bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (auth.router, lectures.router, qa.router, metrics.router):
    app.include_router(router, prefix="/api")


@app.get("/api/health", response_model=HealthOut, tags=["meta"])
def health() -> HealthOut:
    return HealthOut(
        status="ok",
        app=settings.app_name,
        mock_ai=settings.mock_ai,
        transcribe_backend="mock" if settings.mock_ai else settings.transcribe_backend,
        asr_model=settings.effective_asr_model,
        llm_model=settings.effective_llm_model,
        embedding_model=settings.effective_embedding_model,
        hf_configured=bool(settings.hf_token),
    )


# --- Serve the built React app (single-service deploys) -------------------------------
_dist = Path(settings.frontend_dist).resolve()
if (_dist / "index.html").is_file():
    if (_dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (_dist / full_path).resolve()
        if full_path and candidate.is_file() and _dist in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")

    log.info("Serving frontend from %s", _dist)
