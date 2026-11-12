"""Offline benchmark: transcription WER and processing time per hour of audio.

Put audio files next to reference transcripts with the same name:

    benchmarks/samples/lecture1.mp3
    benchmarks/samples/lecture1.txt

Then, from the backend/ folder:

    python -m scripts.benchmark benchmarks/samples --out benchmarks/results.json

Good public sources for references: LibriSpeech test-clean, TED-LIUM 3, or any lecture
with human-made captions. No database is needed.
"""

import argparse
import json
import sys
import tempfile
import time
from pathlib import Path

from app.config import get_settings
from app.services import audio
from app.services.transcribe import transcribe
from app.services.wer import compute_wer

AUDIO_EXT = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus", ".webm", ".mp4"}


def run(sample_dir: Path) -> list[dict]:
    rows = []
    for media in sorted(p for p in sample_dir.iterdir() if p.suffix.lower() in AUDIO_EXT):
        ref = media.with_suffix(".txt")
        if not ref.is_file():
            print(f"skip {media.name}: no {ref.name}", file=sys.stderr)
            continue
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            t0 = time.perf_counter()
            duration = audio.probe_duration(media)
            wav = audio.normalize_audio(media, work / "audio.wav")
            t1 = time.perf_counter()
            result = transcribe(wav, work, duration)
            t2 = time.perf_counter()
        hyp = " ".join(s.text for s in result.segments)
        wer = compute_wer(ref.read_text(encoding="utf-8"), hyp)
        total = t2 - t0
        rows.append({
            "file": media.name,
            "audio_min": round(duration / 60, 2),
            "preprocess_s": round(t1 - t0, 2),
            "transcribe_s": round(t2 - t1, 2),
            "total_s": round(total, 2),
            "min_per_audio_hour": round(total / duration * 60, 2),
            "rtf": round(total / duration, 4),
            "chunks": result.num_chunks,
            **wer,
        })
        print(f"{media.name}: WER {wer['wer']:.2%}, {rows[-1]['min_per_audio_hour']} min / audio hour")
    return rows


def summarize(rows: list[dict]) -> dict:
    audio_s = sum(r["audio_min"] * 60 for r in rows)
    total_s = sum(r["total_s"] for r in rows)
    errors = sum(r["substitutions"] + r["deletions"] + r["insertions"] for r in rows)
    ref_words = sum(r["reference_words"] for r in rows)
    s = get_settings()
    return {
        "backend": "mock" if s.mock_ai else s.transcribe_backend,
        "asr_model": s.effective_asr_model,
        "asr_concurrency": s.asr_concurrency,
        "files": len(rows),
        "audio_hours": round(audio_s / 3600, 3),
        "corpus_wer": round(errors / ref_words, 4) if ref_words else None,  # word-weighted
        "min_per_audio_hour": round(total_s / audio_s * 60, 2) if audio_s else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("samples", type=Path)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    rows = run(args.samples)
    if not rows:
        sys.exit("No audio/reference pairs found.")
    summary = summarize(rows)

    print("\n| file | audio (min) | WER | min / audio hr | RTF |")
    print("|---|---:|---:|---:|---:|")
    for r in rows:
        print(f"| {r['file']} | {r['audio_min']} | {r['wer']:.2%} | {r['min_per_audio_hour']} | {r['rtf']} |")
    print(f"\nCorpus WER: {summary['corpus_wer']:.2%}  ·  "
          f"{summary['min_per_audio_hour']} min per hour of audio  ·  {summary['asr_model']}")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps({"summary": summary, "runs": rows}, indent=2), encoding="utf-8")
        print(f"Saved {args.out}")


if __name__ == "__main__":
    main()
