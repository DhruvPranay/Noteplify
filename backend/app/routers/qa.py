from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import QAEntry, User
from app.schemas import AskIn, QAOut, SearchOut, SourceOut
from app.security import get_current_user, get_owned_lecture
from app.services.common import PipelineError
from app.services.rag import answer_question, hybrid_search

router = APIRouter(tags=["q&a"])
settings = get_settings()


@router.post("/lectures/{lecture_id}/ask", response_model=QAOut)
def ask(lecture_id: int, body: AskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lecture = get_owned_lecture(db, lecture_id, user)
    if lecture.status != "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "This lecture is still being processed")
    question = body.question.strip()
    try:
        hits = hybrid_search(db, question, user.id, lecture_id=lecture.id, k=settings.rag_top_k)
        answer = answer_question(question, hits, lecture.title)
    except PipelineError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    entry = QAEntry(lecture_id=lecture.id, question=question, answer=answer,
                    sources=[h.as_dict() for h in hits])
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/lectures/{lecture_id}/qa", response_model=list[QAOut])
def qa_history(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_lecture(db, lecture_id, user).qa_entries


@router.delete("/lectures/{lecture_id}/qa", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(lecture_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lecture = get_owned_lecture(db, lecture_id, user)
    for entry in list(lecture.qa_entries):
        db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/search", response_model=SearchOut)
def search(
    q: str = Query(min_length=1, max_length=300),
    lecture_id: int | None = None,
    limit: int = Query(default=8, ge=1, le=25),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if lecture_id is not None:
        get_owned_lecture(db, lecture_id, user)
    try:
        hits = hybrid_search(db, q, user.id, lecture_id=lecture_id, k=limit)
    except PipelineError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return SearchOut(query=q, hits=[SourceOut(**h.as_dict()) for h in hits])
