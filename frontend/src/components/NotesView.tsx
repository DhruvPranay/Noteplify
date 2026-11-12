import { BookOpen, Check, Copy, Download, Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { downloadBlob, formatTimestamp } from "../lib/format";
import type { Lecture } from "../lib/types";
import { ReadAloudButton } from "./ReadAloudButton";

export function NotesView({ lecture, onSeek }: { lecture: Lecture; onSeek: (t: number) => void }) {
  const [copied, setCopied] = useState(false);
  const sections = lecture.sections ?? [];
  const takeaways = lecture.key_takeaways ?? [];

  const fullText = useMemo(() => {
    const parts = [lecture.title, lecture.summary ?? ""];
    if (takeaways.length) parts.push("Key takeaways.", ...takeaways);
    sections.forEach((s, i) => parts.push(`Section ${i + 1}: ${s.title}.`, s.summary, ...s.key_points));
    return parts.filter(Boolean).join(" ");
  }, [lecture.title, lecture.summary, takeaways, sections]);

  const copy = async () => {
    await navigator.clipboard.writeText(lecture.notes_markdown ?? fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = async () => {
    const { blob, filename } = await api.exportMarkdown(lecture.id);
    downloadBlob(blob, filename);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ReadAloudButton id="notes-all" text={fullText} label="Read all notes" />
        <button className="btn-ghost py-2" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy Markdown"}
        </button>
        <button className="btn-ghost py-2" onClick={download}>
          <Download className="h-4 w-4" /> Export .md
        </button>
      </div>

      {lecture.summary && (
        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <BookOpen className="h-4 w-4" /> Overview
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{lecture.summary}</p>
        </section>
      )}

      {takeaways.length > 0 && (
        <section className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <Lightbulb className="h-4 w-4" /> Key takeaways
          </div>
          <ul className="space-y-2">
            {takeaways.map((t, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.map((s, i) => (
        <section key={i} className="card p-5 sm:p-6">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex-1">
              <button className="ts mb-1.5" onClick={() => onSeek(s.start)} title="Play from here">
                {formatTimestamp(s.start)} – {formatTimestamp(s.end)}
              </button>
              <h3 className="text-lg font-bold leading-snug">
                <span className="text-muted">{i + 1}.</span> {s.title}
              </h3>
            </div>
            <ReadAloudButton compact id={`section-${i}`} text={[s.title, s.summary, ...s.key_points].join(". ")} label="Read section aloud" />
          </div>
          {s.summary && <p className="mb-4 leading-relaxed text-ink-2">{s.summary}</p>}
          {s.key_points.length > 0 && (
            <ul className="space-y-1.5">
              {s.key_points.map((p, j) => (
                <li key={j} className="flex gap-2.5 leading-relaxed">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {p}
                </li>
              ))}
            </ul>
          )}
          {s.terms.length > 0 && (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {s.terms.map((t, j) => (
                <div key={j} className="rounded-xl bg-surface-2 px-3.5 py-2.5">
                  <dt className="text-sm font-bold">{t.term}</dt>
                  <dd className="text-sm text-ink-2">{t.definition}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}
