from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# Transaction-mode poolers (Neon "-pooler" hosts, Supabase :6543, PgBouncer) can't keep
# server-side prepared statements across transactions, so turn psycopg's auto-prepare off there.
_pooled = "-pooler" in settings.database_url or ":6543" in settings.database_url
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"prepare_threshold": None} if _pooled else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create the pgvector extension, tables and the full-text index."""
    from app import models  # noqa: F401  (register models on Base.metadata)

    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        # Expression index that backs keyword search in hybrid retrieval.
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_chunks_fts ON chunks USING gin (to_tsvector('english', text))")
        )
