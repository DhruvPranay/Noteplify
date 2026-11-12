import { Check, Copy, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatTimestamp } from "../lib/format";
import type { Segment } from "../lib/types";
import { ReadAloudButton } from "./ReadAloudButton";
import { ErrorNote, PageLoader } from "./ui";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "ig"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

export function TranscriptView({ lectureId, onSeek }: { lectureId: number; onSeek: (t: number) => void }) {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.transcript(lectureId).then(setSegments).catch((e: Error) => setError(e.message));
  }, [lectureId]);

  const q = query.trim();
  const visible = useMemo(
    () => (segments ?? []).filter((s) => !q || s.text.toLowerCase().includes(q.toLowerCase())),
    [segments, q],
  );
  const fullText = useMemo(() => (segments ?? []).map((s) => s.text).join(" "), [segments]);
  const words = useMemo(() => fullText.split(/\s+/).filter(Boolean).length, [fullText]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!segments) return <PageLoader />;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Find in transcript…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <ReadAloudButton id="transcript" text={fullText} label="Read" />
        <button
          className="btn-ghost py-2"
          onClick={async () => {
            await navigator.clipboard.writeText(fullText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} Copy
        </button>
      </div>
      <div className="px-4 py-2 text-xs text-muted">
        {q ? `${visible.length} matching segment${visible.length === 1 ? "" : "s"}` : `${segments.length} segments · ${words.toLocaleString()} words`}
      </div>
      <ol className="max-h-[70vh] divide-y divide-line overflow-y-auto">
        {visible.map((s) => (
          <li key={s.idx} className="flex gap-3 px-4 py-3 hover:bg-surface-2/60">
            <button className="ts h-fit shrink-0" onClick={() => onSeek(s.start)} title="Play from here">
              {formatTimestamp(s.start)}
            </button>
            <p className="text-[15px] leading-relaxed text-ink">
              <Highlight text={s.text} query={q} />
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
