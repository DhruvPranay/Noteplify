"""Retrieval-augmented Q&A over lecture transcripts.

Indexing: transcript -> overlapping ~160-word chunks with interpolated timestamps -> embeddings
          stored in PostgreSQL (pgvector) next to a full-text (tsvector) index.
Retrieval: hybrid search — cosine similarity (semantic) + Postgres full-text rank (keywords),
           merged with Reciprocal Rank Fusion.
"""

from collections import defaultdict
from dataclasses import asdict, dataclass

from sqlalchemy import func, literal_column, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Chunk, Lecture
from app.services.common import Segment, fmt_ts, split_sentences
from app.services.embeddings import embed_texts
from app.services.llm import chat
from app.services.prompts import QA_PROMPT, QA_SYSTEM


@dataclass
class ChunkData:
    idx: int
    start: float
    end: float
    text: str


@dataclass
class Hit:
    chunk_id: int
    lecture_id: int
    lecture_title: str
    start: float
    end: float
    text: str
    score: float

    def as_dict(self) -> dict:
        return asdict(self)


def build_chunks(segments: list[Segment], target_words: int = 160, overlap_words: int = 40) -> list[ChunkData]:
    """Sliding word window; each word gets a timestamp interpolated within its segment."""
    words: list[tuple[str, float]] = []
    for seg in segments:
        tokens = seg.text.split()
        span = max(seg.end - seg.start, 0.0)
        for i, tok in enumerate(tokens):
            words.append((tok, seg.start + span * i / max(len(tokens), 1)))
    if not words:
        return []

    end_of_audio = segments[-1].end
    stride = max(1, target_words - overlap_words)
    chunks: list[ChunkData] = []
    i = 0
    while i < len(words):
        window = words[i:i + target_words]
        nxt = i + target_words
        end = words[nxt][1] if nxt < len(words) else end_of_audio
        chunks.append(ChunkData(len(chunks), round(window[0][1], 2), round(end, 2), " ".join(w for w, _ in window)))
        if nxt >= len(words):
            break
        i += stride
    return chunks


def rrf_fuse(rankings: list[list[int]], k: int = 60) -> list[tuple[int, float]]:
    scores: dict[int, float] = defaultdict(float)
    for ranking in rankings:
        for rank, item in enumerate(ranking):
            scores[item] += 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)


def hybrid_search(db: Session, query: str, user_id: int, lecture_id: int | None = None, k: int = 5) -> list[Hit]:
    query = query.strip()
    if not query:
        return []
    qvec = embed_texts([query])[0]
    pool = max(k * 4, 20)

    def scoped(stmt):
        stmt = stmt.join(Lecture, Lecture.id == Chunk.lecture_id).where(Lecture.user_id == user_id)
        return stmt.where(Chunk.lecture_id == lecture_id) if lecture_id is not None else stmt

    vector_ids = db.scalars(
        scoped(select(Chunk.id)).order_by(Chunk.embedding.cosine_distance(qvec)).limit(pool)
    ).all()

    english = literal_column("'english'")
    tsv = func.to_tsvector(english, Chunk.text)
    tsq = func.websearch_to_tsquery(english, query)
    keyword_ids = db.scalars(
        scoped(select(Chunk.id)).where(tsv.op("@@")(tsq)).order_by(func.ts_rank_cd(tsv, tsq).desc()).limit(pool)
    ).all()

    fused = rrf_fuse([list(vector_ids), list(keyword_ids)])[:k]
    if not fused:
        return []
    rows = db.execute(
        select(Chunk, Lecture.title).join(Lecture, Lecture.id == Chunk.lecture_id)
        .where(Chunk.id.in_([cid for cid, _ in fused]))
    ).all()
    by_id = {chunk.id: (chunk, title) for chunk, title in rows}
    return [
        Hit(cid, by_id[cid][0].lecture_id, by_id[cid][1], by_id[cid][0].start, by_id[cid][0].end,
            by_id[cid][0].text, round(score, 5))
        for cid, score in fused if cid in by_id
    ]


def answer_question(question: str, hits: list[Hit], lecture_title: str) -> str:
    if not hits:
        return "I couldn't find anything about that in this lecture."
    if get_settings().mock_ai:
        best = split_sentences(hits[0].text)[:3] or [hits[0].text[:300]]
        return f"(Demo mode) The most relevant part of the lecture says: {' '.join(best)} [1]"
    context = "\n\n".join(
        f"[{n}] ({fmt_ts(h.start)}–{fmt_ts(h.end)}) {h.text}" for n, h in enumerate(hits, 1)
    )
    return chat(
        [{"role": "system", "content": QA_SYSTEM},
         {"role": "user", "content": QA_PROMPT.format(lecture_title=lecture_title, context=context, question=question)}],
        max_tokens=700,
    )
