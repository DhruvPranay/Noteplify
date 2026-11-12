"""Sentence embeddings: Hugging Face feature-extraction API, or local ONNX via fastembed."""

import hashlib
import math
import re
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

import numpy as np

from app.config import get_settings
from app.services.common import PipelineError
from app.services.hf import get_client, with_retries

_TOKEN_RE = re.compile(r"[a-z0-9']+")


def embed_texts(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    if not texts:
        return []
    if s.mock_ai:
        return [hash_embedding(t, s.embedding_dim) for t in texts]
    if s.embedding_backend == "local":
        return [_check_and_normalize(np.asarray(v, dtype=np.float32)) for v in _local_embedder().embed(texts)]
    with ThreadPoolExecutor(max_workers=4, thread_name_prefix="embed") as ex:
        return list(ex.map(_embed_one, texts))


@lru_cache(maxsize=1)
def _local_embedder():
    try:
        from fastembed import TextEmbedding
    except ImportError:
        raise PipelineError("EMBEDDING_BACKEND=local needs `pip install -r requirements-local.txt`.") from None
    return TextEmbedding(model_name=get_settings().embedding_model)


def _check_and_normalize(arr: np.ndarray) -> list[float]:
    dim = get_settings().embedding_dim
    if arr.shape[0] != dim:
        raise PipelineError(f"Embedding model returned {arr.shape[0]} dimensions but EMBEDDING_DIM is {dim}.")
    norm = float(np.linalg.norm(arr)) or 1.0
    return (arr / norm).tolist()


def _embed_one(text: str) -> list[float]:
    s = get_settings()
    client = get_client()
    raw = with_retries(lambda: client.feature_extraction(text, model=s.embedding_model), what="Embedding request")
    arr = np.asarray(raw, dtype=np.float32)
    # Sentence-transformer endpoints return (dim,) or (1, dim); raw encoders return token
    # vectors (tokens, dim) or (1, tokens, dim) which we mean-pool.
    while arr.ndim > 2:
        arr = arr[0]
    if arr.ndim == 2:
        arr = arr[0] if arr.shape[0] == 1 else arr.mean(axis=0)
    return _check_and_normalize(arr)


def hash_embedding(text: str, dim: int) -> list[float]:
    """Deterministic bag-of-words hashing vector — a no-network stand-in for mock mode."""
    vec = [0.0] * dim
    for token in _TOKEN_RE.findall(text.lower()):
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        vec[h % dim] += 1.0 if (h >> 8) & 1 else -1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]
