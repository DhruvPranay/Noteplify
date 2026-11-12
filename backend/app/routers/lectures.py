import mimetypes
import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Lecture, User
from app.pipeline import enqueue
from app.schemas import (
    FlashcardOut, LectureListItem, LectureOut, LectureUpdate, MediaTokenOut, SegmentOut, YouTubeIn,
)
from app.security import create_token, decode_token, get_current_user, get_owned_lecture
from app.services.notes import render_markdown
from app.services.youtube import PLACEHOLDER_TITLE, extract_video_id

router = APIRouter(prefix="/lectures", tags=["lectures"])
settings = get_settings()

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".webm", ".mp4", ".mov", ".mkv", ".avi",
}
MEDIA_TOKEN_MINUTES = 6 * 60


@router.get("", response_model=list[LectureListItem])
def list_lectures(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Lecture).where(Lecture.user_id == user.id).order_by(Lecture.created_at.desc())
    ).all()


@router.post("/upload", response_model=LectureOut, status_code=status.HTTP_201_CREATED)
async def upload_lecture(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = file.filename or "lecture"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Unsupported file type '{ext or '?'}'. Upload an audio or video file.")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid4().hex}{ext}"
    max_bytes = settings.max_upload_mb * 1024 * 1024
    size = 0
    try:
        with dest.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                        f"File is larger than {settings.max_upload_mb} MB")
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty")

    lecture = Lecture(
        user_id=user.id,
        title=((title or "").strip() or Path(filename).stem or "Untitled lecture")[:300],
        source_type="upload",
        file_path=str(dest),
        original_filename=filename[:300],
        status="queued",
        stage="queued",
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    enqueue(lecture.id)
    return lecture


@router.post("/youtube", response_model=LectureOut, status_code=status.HTTP_201_CREATED)
def create_from_youtube(body: YouTubeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    video_id = extract_video_id(body.url)
    if not video_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That doesn't look like a YouTube video link")
    lecture = Lecture(
        user_id=user.id,
        title=((body.title or "").strip() or PLACEHOLDER_TITLE)[:300],
        source_type="youtube",
        source_url=f"https://www.youtube.com/watch?v={video_id}",
        youtube_id=video_id,
        status="queued",
        stage="queued",
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    enqueue(lecture.id)
    return lecture


@router.get("/{lecture_id}", response_model=LectureOut)
def get_lecture(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_lecture(db, lecture_id, user)


@router.patch("/{lecture_id}", response_model=LectureOut)
def rename_lecture(lecture_id: int, body: LectureUpdate,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lecture = get_owned_lecture(db, lecture_id, user)
    lecture.title = body.title.strip()
    db.commit()
    return lecture


@router.delete("/{lecture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecture(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lecture = get_owned_lecture(db, lecture_id, user)
    if lecture.file_path:
        Path(lecture.file_path).unlink(missing_ok=True)
    db.delete(lecture)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{lecture_id}/retry", response_model=LectureOut)
def retry_lecture(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lecture = get_owned_lecture(db, lecture_id, user)
    if lecture.status in ("queued", "processing"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This lecture is already being processed")
    lecture.status, lecture.stage, lecture.progress, lecture.error = "queued", "queued", 0.0, None
    db.commit()
    enqueue(lecture.id)
    return lecture


@router.get("/{lecture_id}/transcript", response_model=list[SegmentOut])
def get_transcript(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_lecture(db, lecture_id, user).segments


@router.get("/{lecture_id}/flashcards", response_model=list[FlashcardOut])
def get_flashcards(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_lecture(db, lecture_id, user).flashcards


@router.get("/{lecture_id}/export")
def export_markdown(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lecture = get_owned_lecture(db, lecture_id, user)
    if lecture.status != "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Notes are not ready yet")
    cards = [{"question": c.question, "answer": c.answer} for c in lecture.flashcards]
    body = render_markdown(lecture.title, lecture.summary or "", lecture.key_takeaways or [],
                           lecture.sections or [], cards)
    slug = re.sub(r"[^a-z0-9]+", "-", lecture.title.lower()).strip("-")[:60] or "lecture"
    return Response(body, media_type="text/markdown; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{slug}-notes.md"'})


@router.get("/{lecture_id}/media-token", response_model=MediaTokenOut)
def media_token(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Short-lived, lecture-scoped token so an <audio> tag can stream without an auth header."""
    get_owned_lecture(db, lecture_id, user)
    token = create_token(user.id, scope=f"media:{lecture_id}", minutes=MEDIA_TOKEN_MINUTES)
    return MediaTokenOut(token=token, expires_in=MEDIA_TOKEN_MINUTES * 60)


@router.get("/{lecture_id}/audio")
def stream_audio(lecture_id: int, token: str = Query(...), db: Session = Depends(get_db)):
    payload = decode_token(token, scope=f"media:{lecture_id}")
    lecture = db.get(Lecture, lecture_id)
    if lecture is None or str(lecture.user_id) != payload["sub"] or not lecture.has_audio:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Audio not available")
    media_type = mimetypes.guess_type(lecture.file_path or "")[0] or "application/octet-stream"
    return FileResponse(lecture.file_path, media_type=media_type)
