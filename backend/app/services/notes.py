"""Structured notes + flashcards via map-reduce over the transcript.

Map:    each ~1,500-word section -> {title, summary, key_points, terms, flashcards}  (parallel)
Reduce: section summaries -> {title, summary, key_takeaways} for the whole lecture
The final Markdown is rendered deterministically from that JSON, so it is always well-formed.
"""

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

from app.config import get_settings
from app.services.common import PipelineError, Segment, fmt_ts, split_sentences
from app.services.llm import chat_json
from app.services.prompts import OVERVIEW_PROMPT, OVERVIEW_SYSTEM, SECTION_PROMPT, SECTION_SYSTEM

log = logging.getLogger(__name__)
MAX_FLASHCARDS = 40


@dataclass
class Section:
    start: float
    end: float
    text: str


@dataclass
class NotesResult:
    title: str
    summary: str
    key_takeaways: list[str]
    sections: list[dict]
    flashcards: list[dict]
    markdown: str = ""
    failed_sections: int = 0
    extra: dict = field(default_factory=dict)


def split_sections(segments: list[Segment], target_words: int) -> list[Section]:
    sections: list[Section] = []
    buf: list[Segment] = []
    words = 0
    for seg in segments:
        buf.append(seg)
        words += len(seg.text.split())
        if words >= target_words:
            sections.append(Section(buf[0].start, buf[-1].end, " ".join(s.text for s in buf)))
            buf, words = [], 0
    if buf:
        tail = Section(buf[0].start, buf[-1].end, " ".join(s.text for s in buf))
        if sections and words < target_words * 0.3:  # fold a tiny tail into the previous section
            prev = sections[-1]
            sections[-1] = Section(prev.start, tail.end, f"{prev.text} {tail.text}")
        else:
            sections.append(tail)
    return sections


def _strings(value, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()][:limit]


def _clean_section(raw, sec: Section) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    terms = [
        {"term": str(t.get("term", "")).strip(), "definition": str(t.get("definition", "")).strip()}
        for t in raw.get("terms") or [] if isinstance(t, dict) and str(t.get("term", "")).strip()
    ][:6]
    cards = [
        {"question": str(c.get("question", "")).strip(), "answer": str(c.get("answer", "")).strip()}
        for c in raw.get("flashcards") or []
        if isinstance(c, dict) and str(c.get("question", "")).strip() and str(c.get("answer", "")).strip()
    ][:6]
    return {
        "title": (str(raw.get("title") or "").strip() or "Untitled section")[:120],
        "start": sec.start,
        "end": sec.end,
        "summary": str(raw.get("summary") or "").strip(),
        "key_points": _strings(raw.get("key_points"), 8),
        "terms": terms,
        "flashcards": cards,
    }


def _extractive_section(text: str) -> dict:
    """Fallback (and mock-mode) notes built straight from transcript sentences."""
    sentences = split_sentences(text) or [text[:300]]
    title_words = sentences[0].split()[:7]
    points = sentences[2:7] or sentences[:5]
    return {
        "title": " ".join(title_words).rstrip(".,;:") or "Section",
        "summary": " ".join(sentences[:2]),
        "key_points": points,
        "terms": [],
        "flashcards": [
            {"question": f"What did the lecture explain about “{' '.join(p.split()[:6]).rstrip('.,')}…”?",
             "answer": p}
            for p in points[:3]
        ],
    }


def _section_notes(sec: Section, index: int, total: int, lecture_title: str) -> dict:
    if get_settings().mock_ai:
        return _clean_section(_extractive_section(sec.text), sec)
    prompt = SECTION_PROMPT.format(
        lecture_title=lecture_title, index=index + 1, total=total,
        start=fmt_ts(sec.start), end=fmt_ts(sec.end), text=sec.text,
    )
    raw = chat_json(
        [{"role": "system", "content": SECTION_SYSTEM}, {"role": "user", "content": prompt}],
        max_tokens=1400,
    )
    return _clean_section(raw, sec)


def _overview(sections: list[dict], fallback_title: str) -> tuple[str, str, list[str]]:
    if len(sections) == 1:
        # One section already *is* the overview — another LLM pass only adds room to invent things.
        only = sections[0]
        return fallback_title, only["summary"], only["key_points"][:6]
    fallback = (
        fallback_title,
        " ".join(s["summary"] for s in sections[:3] if s["summary"]),
        [s["key_points"][0] for s in sections if s["key_points"]][:6],
    )
    if get_settings().mock_ai:
        return fallback
    listing = "\n\n".join(
        f"{i}. [{fmt_ts(s['start'])}] {s['title']}\nSummary: {s['summary']}\n"
        + "\n".join(f"- {p}" for p in s["key_points"])
        for i, s in enumerate(sections, 1)
    )
    try:
        raw = chat_json(
            [{"role": "system", "content": OVERVIEW_SYSTEM},
             {"role": "user", "content": OVERVIEW_PROMPT.format(sections=listing)}],
            max_tokens=800,
        )
    except (PipelineError, ValueError) as exc:
        log.warning("Overview generation failed, using fallback: %s", exc)
        return fallback
    raw = raw if isinstance(raw, dict) else {}
    return (
        (str(raw.get("title") or "").strip() or fallback[0])[:200],
        str(raw.get("summary") or "").strip() or fallback[1],
        _strings(raw.get("key_takeaways"), 8) or fallback[2],
    )


def render_markdown(title: str, summary: str, takeaways: list[str], sections: list[dict],
                    flashcards: list[dict] | None = None) -> str:
    out = [f"# {title}", ""]
    if summary:
        out += [f"> {summary}", ""]
    if takeaways:
        out += ["## Key takeaways", "", *[f"- {t}" for t in takeaways], ""]
    for i, s in enumerate(sections, 1):
        out += [f"## {i}. {s['title']}  ·  {fmt_ts(s['start'])}–{fmt_ts(s['end'])}", ""]
        if s["summary"]:
            out += [s["summary"], ""]
        if s["key_points"]:
            out += ["**Key points**", "", *[f"- {p}" for p in s["key_points"]], ""]
        if s["terms"]:
            out += ["**Terms**", "", *[f"- **{t['term']}** — {t['definition']}" for t in s["terms"]], ""]
    if flashcards:
        out += ["## Flashcards", ""]
        for i, c in enumerate(flashcards, 1):
            out += [f"**Q{i}. {c['question']}**", "", f"{c['answer']}", ""]
    return "\n".join(out).strip() + "\n"


def generate_notes(segments: list[Segment], lecture_title: str,
                   on_progress: Callable[[float], None] | None = None) -> NotesResult:
    s = get_settings()
    sections = split_sections(segments, s.section_words)
    if not sections:
        raise PipelineError("The transcript is empty — no speech was detected in this recording.")

    results: list[dict | None] = [None] * len(sections)
    errors: list[Exception] = []
    with ThreadPoolExecutor(max_workers=max(1, s.llm_concurrency), thread_name_prefix="notes") as ex:
        futures = {
            ex.submit(_section_notes, sec, i, len(sections), lecture_title): i for i, sec in enumerate(sections)
        }
        for done, future in enumerate(as_completed(futures), start=1):
            i = futures[future]
            try:
                results[i] = future.result()
            except Exception as exc:  # noqa: BLE001 - degrade one section, not the whole lecture
                log.warning("Section %d notes failed: %s", i, exc)
                errors.append(exc)
                results[i] = _clean_section(_extractive_section(sections[i].text), sections[i])
            if on_progress:
                on_progress(done / (len(sections) + 1))
    if len(errors) == len(sections):
        raise errors[0] if isinstance(errors[0], PipelineError) else PipelineError(str(errors[0]))

    section_notes = [r for r in results if r is not None]
    title, summary, takeaways = _overview(section_notes, lecture_title)
    if on_progress:
        on_progress(1.0)

    seen: set[str] = set()
    flashcards: list[dict] = []
    for sec in section_notes:
        for card in sec.pop("flashcards", []):
            key = card["question"].lower()
            if key not in seen and len(flashcards) < MAX_FLASHCARDS:
                seen.add(key)
                flashcards.append(card)

    result = NotesResult(title, summary, takeaways, section_notes, flashcards, failed_sections=len(errors))
    result.markdown = render_markdown(title, summary, takeaways, section_notes)
    return result
