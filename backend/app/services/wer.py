"""Word Error Rate = (substitutions + deletions + insertions) / reference words."""

import re

import jiwer

_PUNCT = re.compile(r"[^\w\s']")
_SPACE = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Lower-case, strip punctuation and collapse whitespace so WER measures words, not formatting."""
    text = text.lower().replace("’", "'")
    text = _PUNCT.sub(" ", text)
    return _SPACE.sub(" ", text).strip()


def compute_wer(reference: str, hypothesis: str) -> dict:
    ref, hyp = normalize(reference), normalize(hypothesis)
    if not ref:
        raise ValueError("The reference transcript is empty after normalisation.")
    if not hyp:
        n = len(ref.split())
        return {"wer": 1.0, "substitutions": 0, "deletions": n, "insertions": 0, "hits": 0,
                "reference_words": n, "hypothesis_words": 0}
    out = jiwer.process_words(ref, hyp)
    return {
        "wer": round(out.wer, 4),
        "substitutions": out.substitutions,
        "deletions": out.deletions,
        "insertions": out.insertions,
        "hits": out.hits,
        "reference_words": len(ref.split()),
        "hypothesis_words": len(hyp.split()),
    }
