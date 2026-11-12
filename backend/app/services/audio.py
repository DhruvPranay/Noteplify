"""ffmpeg helpers: probing, normalising to 16 kHz mono, and silence-aware chunking."""

import re
import shutil
import subprocess
from pathlib import Path

from app.services.common import PipelineError

_SILENCE_START = re.compile(r"silence_start:\s*(-?[\d.]+)")
_SILENCE_END = re.compile(r"silence_end:\s*([\d.]+)")


def _run(cmd: list[str], timeout: float | None = None) -> subprocess.CompletedProcess:
    if shutil.which(cmd[0]) is None:
        raise PipelineError(f"{cmd[0]} is not installed on the server (it is required to read audio).")
    proc = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout
    )
    if proc.returncode != 0:
        raise PipelineError(f"{cmd[0]} could not process the file: {proc.stderr.strip()[-500:]}")
    return proc


def probe_duration(path: Path) -> float:
    proc = _run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        timeout=120,
    )
    try:
        return float(proc.stdout.strip().splitlines()[0])
    except (IndexError, ValueError):
        raise PipelineError("Couldn't read the audio duration. Is this a valid audio or video file?") from None


def normalize_audio(src: Path, dest: Path) -> Path:
    """Decode any audio/video into 16 kHz mono PCM WAV — the format Whisper expects."""
    _run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", str(src),
         "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(dest)],
        timeout=3600,
    )
    return dest


def detect_silences(path: Path, noise_db: int = -35, min_silence: float = 0.3) -> list[tuple[float, float]]:
    proc = _run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(path),
         "-af", f"silencedetect=noise={noise_db}dB:d={min_silence}", "-f", "null", "-"],
        timeout=3600,
    )
    silences: list[tuple[float, float]] = []
    start: float | None = None
    for line in proc.stderr.splitlines():
        if m := _SILENCE_START.search(line):
            start = max(0.0, float(m.group(1)))
        elif (m := _SILENCE_END.search(line)) and start is not None:
            silences.append((start, float(m.group(1))))
            start = None
    return silences


def plan_cut_points(
    duration: float, silences: list[tuple[float, float]], target: float = 30.0, window: float = 10.0
) -> list[float]:
    """Pick cut points at most `target` seconds apart, preferring the middle of a pause.

    Cutting on silence instead of every N seconds avoids splitting words in half,
    which is a measurable source of WER on chunked long-form transcription.
    """
    window = min(window, target * 0.9)
    mids = sorted((s + e) / 2 for s, e in silences)
    cuts: list[float] = []
    pos = 0.0
    while duration - pos > target:
        lo, hi = pos + target - window, pos + target
        candidates = [m for m in mids if lo <= m <= hi]
        cut = max(candidates) if candidates else hi
        cuts.append(round(cut, 3))
        pos = cut
    return cuts


def split_audio(wav: Path, out_dir: Path, cuts: list[float], duration: float) -> list[tuple[Path, float, float]]:
    """Cut the normalised WAV into FLAC chunks (≈4x smaller than WAV to upload).

    Each chunk is extracted with its own ffmpeg call (fast: sample-accurate seeking in PCM)
    so every file gets a complete header — the segment muxer leaves FLAC durations unset.
    Returns (path, start, end) per chunk.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    bounds = [0.0, *cuts, duration]
    chunks: list[tuple[Path, float, float]] = []
    for i, (start, end) in enumerate(zip(bounds, bounds[1:])):
        if end - start < 0.05:
            continue
        out = out_dir / f"chunk_{i:05d}.flac"
        _run(
            ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
             "-i", str(wav), "-c:a", "flac", str(out)],
            timeout=600,
        )
        chunks.append((out, start, end))
    return chunks
