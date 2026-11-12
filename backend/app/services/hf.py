"""Shared Hugging Face InferenceClient with retry handling."""

import logging
import time
from collections.abc import Callable
from functools import lru_cache
from typing import TypeVar

from huggingface_hub import InferenceClient

from app.config import get_settings
from app.services.common import PipelineError

log = logging.getLogger(__name__)
T = TypeVar("T")

# Errors that retrying will never fix.
_FATAL_STATUS = {400, 401, 402, 403, 404, 413, 422}


@lru_cache(maxsize=1)
def get_client() -> InferenceClient:
    s = get_settings()
    if not s.hf_token:
        raise PipelineError(
            "HF_TOKEN is not configured on the server. Add a Hugging Face access token, "
            "or set MOCK_AI=true to try Noteplify with simulated AI."
        )
    return InferenceClient(provider=s.hf_provider, token=s.hf_token, timeout=s.hf_timeout)


def _status_code(exc: Exception) -> int | None:
    response = getattr(exc, "response", None)
    return getattr(response, "status_code", None)


def with_retries(fn: Callable[[], T], *, what: str, attempts: int = 4, base_delay: float = 2.0) -> T:
    """Retry transient failures (cold-starting models return 503, rate limits 429)."""
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            return fn()
        except PipelineError:
            raise
        except Exception as exc:  # noqa: BLE001 - provider SDKs raise many types
            last = exc
            code = _status_code(exc)
            if code == 402:
                raise PipelineError(
                    f"{what} failed: your Hugging Face account is out of Inference Provider credits (402). "
                    "Add credits / upgrade, set HF_PROVIDER to a provider you have credit with, "
                    "or use TRANSCRIBE_BACKEND=local for free on-device Whisper."
                ) from exc
            if code in _FATAL_STATUS:
                raise PipelineError(f"{what} was rejected by Hugging Face ({code}): {exc}") from exc
            if attempt < attempts - 1:
                delay = base_delay * 2**attempt
                log.warning("%s failed (%s); retrying in %.0fs", what, exc, delay)
                time.sleep(delay)
    raise PipelineError(f"{what} failed after {attempts} attempts: {last}")
