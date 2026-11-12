"""Small shared helpers: errors, timing, timestamp formatting, sentence splitting."""

import re
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass


class PipelineError(RuntimeError):
    """An expected failure whose message is safe to show to the user."""


@dataclass
class Segment:
    start: float
    end: float
    text: str


class StageTimer:
    """Accumulates wall-clock time per named stage."""

    def __init__(self) -> None:
        self.durations: dict[str, float] = {}
        self._t0 = time.perf_counter()

    @contextmanager
    def stage(self, name: str) -> Iterator[None]:
        t = time.perf_counter()
        try:
            yield
        finally:
            self.durations[name] = self.durations.get(name, 0.0) + time.perf_counter() - t

    def get(self, name: str) -> float:
        return round(self.durations.get(name, 0.0), 3)

    @property
    def total(self) -> float:
        return round(time.perf_counter() - self._t0, 3)


def fmt_ts(seconds: float) -> str:
    seconds = max(0, int(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_RE.split(text) if len(s.strip()) > 3]
