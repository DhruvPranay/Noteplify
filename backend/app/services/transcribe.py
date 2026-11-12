"""Speech-to-text with Whisper.

Two backends:
  * "hf"    – Whisper on the Hugging Face Inference API. Audio is split on silences into
              ≤30 s chunks that are transcribed in parallel, which keeps processing time
              per hour of audio low and avoids payload limits.
  * "local" – faster-whisper on the server's own CPU/GPU (optional dependency).
"""

import logging
import wave
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.config import get_settings
from app.services import audio
from app.services.common import PipelineError, Segment
from app.services.hf import get_client, with_retries

log = logging.getLogger(__name__)
ProgressFn = Callable[[float], None] | None


@dataclass
class TranscriptionResult:
    segments: list[Segment]
    language: str | None
    backend: str
    model: str
    num_chunks: int


def transcribe(wav: Path, workdir: Path, duration: float, on_progress: ProgressFn = None) -> TranscriptionResult:
    s = get_settings()
    if s.mock_ai:
        return _mock(duration)
    if s.transcribe_backend == "local":
        return _local(wav, duration, on_progress)
    return _hf(wav, workdir, duration, on_progress)


# --- Hugging Face Inference API -------------------------------------------------
def _hf(wav: Path, workdir: Path, duration: float, on_progress: ProgressFn) -> TranscriptionResult:
    s = get_settings()
    client = get_client()

    silences = audio.detect_silences(wav)
    cuts = audio.plan_cut_points(duration, silences, s.chunk_seconds, s.chunk_search_window)
    chunks = audio.split_audio(wav, workdir / "chunks", cuts, duration)
    if not chunks:
        raise PipelineError("Audio chunking produced no output.")

    def work(i: int, path: Path) -> tuple[int, str]:
        out = with_retries(
            lambda: client.automatic_speech_recognition(str(path), model=s.asr_model),
            what=f"Transcription of chunk {i + 1}/{len(chunks)}",
        )
        return i, (getattr(out, "text", None) or "").strip()

    texts: list[str] = [""] * len(chunks)
    executor = ThreadPoolExecutor(max_workers=max(1, s.asr_concurrency), thread_name_prefix="asr")
    try:
        futures = [executor.submit(work, i, path) for i, (path, _, _) in enumerate(chunks)]
        for done, future in enumerate(as_completed(futures), start=1):
            i, text = future.result()
            texts[i] = text
            if on_progress:
                on_progress(done / len(chunks))
    finally:
        executor.shutdown(wait=True, cancel_futures=True)

    segments = [
        Segment(start=round(chunks[i][1], 2), end=round(chunks[i][2], 2), text=t)
        for i, t in enumerate(texts) if t
    ]
    return TranscriptionResult(segments, None, "hf", s.asr_model, len(chunks))


# --- Local faster-whisper ---------------------------------------------------------
@lru_cache(maxsize=1)
def _local_model():
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise PipelineError("TRANSCRIBE_BACKEND=local needs `pip install faster-whisper`.") from None
    s = get_settings()
    compute = "int8_float16" if s.local_whisper_device == "cuda" else "int8"
    return WhisperModel(s.local_whisper_size, device=s.local_whisper_device, compute_type=compute)


def _local(wav: Path, duration: float, on_progress: ProgressFn) -> TranscriptionResult:
    s = get_settings()
    model = _local_model()
    # The input is already 16 kHz mono PCM, so decode it directly instead of going through
    # PyAV (whose API shifts between releases).
    with wave.open(str(wav), "rb") as w:
        samples = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    raw_segments, info = model.transcribe(samples, vad_filter=True, beam_size=5)
    segments: list[Segment] = []
    for seg in raw_segments:  # generator: transcription happens while iterating
        text = seg.text.strip()
        if text:
            segments.append(Segment(round(seg.start, 2), round(seg.end, 2), text))
        if on_progress and duration:
            on_progress(min(seg.end / duration, 1.0))
    return TranscriptionResult(segments, info.language, "local", f"faster-whisper-{s.local_whisper_size}", 1)


# --- Mock (no AI) -----------------------------------------------------------------
_MOCK_LINES = [
    "Welcome back everyone, today we are going to talk about how neural networks learn from data.",
    "A neural network is a function made of layers, and each layer applies a linear transformation followed by a non-linearity.",
    "The parameters of the network are the weights and biases, and training means finding values that minimise a loss function.",
    "Gradient descent is the algorithm we use for that: we compute the gradient of the loss and take a small step in the opposite direction.",
    "The size of that step is called the learning rate, and choosing it well is one of the most important practical decisions you will make.",
    "Backpropagation is simply the chain rule from calculus, applied efficiently from the output layer back to the input layer.",
    "Overfitting happens when the model memorises the training set instead of learning patterns that generalise to new data.",
    "Regularisation techniques such as dropout and weight decay help reduce overfitting by limiting how complex the model can become.",
    "We always keep a separate validation set so that we can measure generalisation honestly while we tune hyperparameters.",
    "Stochastic gradient descent uses small random mini-batches, which makes each step cheaper and adds helpful noise.",
    "Optimisers like Adam adapt the learning rate for each parameter using running averages of the gradients.",
    "For next week, please read chapter six and try the exercises on implementing backpropagation by hand.",
]


def _mock(duration: float) -> TranscriptionResult:
    segments, t, i = [], 0.0, 0
    step = 30.0
    while t < max(duration, 1):
        end = min(t + step, duration)
        text = " ".join(_MOCK_LINES[(i + k) % len(_MOCK_LINES)] for k in range(2))
        segments.append(Segment(round(t, 2), round(end, 2), text))
        t += step
        i += 2
    return TranscriptionResult(segments, "en", "mock", "mock-whisper", len(segments))
