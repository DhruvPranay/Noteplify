"""Unit tests for the pure logic (no database, network or ffmpeg needed)."""

import math

import pytest

from app.services.audio import plan_cut_points
from app.services.common import Segment, fmt_ts
from app.services.embeddings import hash_embedding
from app.services.llm import parse_json
from app.services.notes import render_markdown, split_sections
from app.services.rag import build_chunks, rrf_fuse
from app.services.wer import compute_wer, normalize
from app.services.youtube import extract_video_id


def test_parse_json_handles_fences_and_chatter():
    raw = 'Sure! Here you go:\n```json\n{"title": "Gradient descent", "key_points": ["a", "b"]}\n```'
    assert parse_json(raw) == {"title": "Gradient descent", "key_points": ["a", "b"]}


def test_parse_json_rejects_prose():
    with pytest.raises(ValueError):
        parse_json("no json here")


def test_cut_points_prefer_silence_and_respect_max_length():
    silences = [(27.0, 28.0), (55.0, 56.0)]
    cuts = plan_cut_points(90.0, silences, target=30.0, window=10.0)
    assert cuts[0] == 27.5 and cuts[1] == 55.5
    edges = [0.0, *cuts, 90.0]
    assert all(b - a <= 30.0 for a, b in zip(edges, edges[1:]))


def test_cut_points_fall_back_to_hard_cut():
    assert plan_cut_points(65.0, [], target=30.0) == [30.0, 60.0]
    assert plan_cut_points(20.0, [], target=30.0) == []


def test_wer_basic_and_normalisation():
    assert normalize("Hello, World!") == "hello world"
    result = compute_wer("the cat sat on the mat", "the cat sat on a mat")
    assert result["wer"] == pytest.approx(1 / 6, abs=1e-4)
    assert result["substitutions"] == 1
    assert compute_wer("Hello world.", "hello WORLD")["wer"] == 0.0
    assert compute_wer("one two", "")["wer"] == 1.0


def test_build_chunks_overlap_and_timestamps():
    segs = [Segment(i * 30.0, (i + 1) * 30.0, " ".join(f"w{i}_{j}" for j in range(100))) for i in range(4)]
    chunks = build_chunks(segs, target_words=160, overlap_words=40)
    assert chunks[0].start == 0.0
    assert chunks[0].text.split()[-40:] == chunks[1].text.split()[:40]
    assert all(c.start < c.end for c in chunks)
    assert chunks[-1].end == 120.0


def test_rrf_rewards_agreement():
    fused = rrf_fuse([[1, 2, 3], [3, 1, 4]])
    assert fused[0][0] == 1
    assert {i for i, _ in fused} == {1, 2, 3, 4}


def test_split_sections_folds_small_tail():
    segs = [Segment(i, i + 1, " ".join(["word"] * 100)) for i in range(16)]
    sections = split_sections(segs, target_words=500)
    assert len(sections) == 3  # 5+5+6 segments: the 100-word tail is folded in
    assert sections[-1].end == 16


def test_hash_embedding_is_normalised_and_similar_for_overlap():
    a, b, c = (hash_embedding(t, 384) for t in ("gradient descent step", "gradient descent", "pizza recipe"))
    assert math.isclose(sum(x * x for x in a), 1.0, rel_tol=1e-6)
    dot = lambda x, y: sum(p * q for p, q in zip(x, y))  # noqa: E731
    assert dot(a, b) > dot(a, c)


def test_extract_video_id():
    assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10") == "dQw4w9WgXcQ"
    assert extract_video_id("youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert extract_video_id("https://youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert extract_video_id("https://vimeo.com/123") is None


def test_render_markdown_and_timestamps():
    assert fmt_ts(3725) == "1:02:05" and fmt_ts(65) == "01:05"
    md = render_markdown("T", "S", ["k"], [{"title": "A", "start": 0, "end": 60, "summary": "x",
                                         "key_points": ["p"], "terms": [{"term": "t", "definition": "d"}]}])
    assert md.startswith("# T") and "## 1. A" in md and "**t** — d" in md
