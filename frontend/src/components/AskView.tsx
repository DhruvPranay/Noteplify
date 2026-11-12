import { ChevronDown, Mic, MicOff, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useDictation } from "../hooks/useDictation";
import { api, ApiError } from "../lib/api";
import { formatTimestamp } from "../lib/format";
import type { Lecture, QAEntry, Source } from "../lib/types";
import { ReadAloudButton } from "./ReadAloudButton";
import { ErrorNote, Spinner } from "./ui";

const SUGGESTIONS = [
  "Summarize the main idea in simple terms",
  "What definitions should I memorize?",
  "What examples did the lecturer use?",
  "What might come up on an exam?",
];

/** Render **bold**, bullet lists and [n] citation chips from a model answer. */
function RichAnswer({ text, sources, onSeek }: { text: string; sources: Source[]; onSeek: (t: number) => void }) {
  const inline = (line: string, key: number): ReactNode => (
    <Fragment key={key}>
      {line.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
        const bold = /^\*\*(.+)\*\*$/.exec(part);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const cite = /^\[(\d+)\]$/.exec(part);
        if (cite) {
          const src = sources[Number(cite[1]) - 1];
          return src ? (
            <button key={i} className="ts mx-0.5 align-baseline" onClick={() => onSeek(src.start)}
              title={`Jump to ${formatTimestamp(src.start)}`}>
              {formatTimestamp(src.start)}
            </button>
          ) : null;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );

  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
          {list.map((l, i) => <li key={i}>{inline(l, i)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  text.split("\n").forEach((raw) => {
    const line = raw.trim();
    const item = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) list.push(item[1]);
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`} className="my-2">{inline(line.replace(/^#+\s*/, ""), 0)}</p>);
    }
  });
  flush();
  return <div className="leading-relaxed">{blocks}</div>;
}

function Sources({ sources, onSeek }: { sources: Source[]; onSeek: (t: number) => void }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <button className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink" onClick={() => setOpen((o) => !o)}>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
        {sources.length} source excerpt{sources.length === 1 ? "" : "s"} from the transcript
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <li key={s.chunk_id} className="rounded-xl bg-surface-2 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-bold text-muted">[{i + 1}]</span>
                <button className="ts" onClick={() => onSeek(s.start)}>
                  {formatTimestamp(s.start)} – {formatTimestamp(s.end)}
                </button>
              </div>
              <p className="line-clamp-4 text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AskView({ lecture, onSeek }: { lecture: Lecture; onSeek: (t: number) => void }) {
  const [history, setHistory] = useState<QAEntry[] | null>(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dictation = useDictation(setQuestion);

  useEffect(() => {
    api.qaHistory(lecture.id).then(setHistory).catch(() => setHistory([]));
  }, [lecture.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [history?.length, pending]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || pending) return;
    setError(null);
    setPending(text);
    setQuestion("");
    try {
      const entry = await api.ask(lecture.id, text);
      setHistory((h) => [...(h ?? []), entry]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't get an answer.");
      setQuestion(text);
    } finally {
      setPending(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  const clear = async () => {
    await api.clearQa(lecture.id);
    setHistory([]);
  };

  return (
    <div className="card flex min-h-[520px] flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-brand" /> Ask about this lecture
        </div>
        {!!history?.length && (
          <button className="btn-icon h-8 w-8" onClick={clear} title="Clear conversation" aria-label="Clear conversation">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {history === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : history.length === 0 && !pending ? (
          <div className="py-6 text-center">
            <p className="text-sm text-ink-2">
              Answers come only from this lecture's transcript, with timestamps you can click.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:border-brand hover:text-brand"
                  onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="space-y-3 animate-fade-in">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-ink">
                {entry.question}
              </div>
              <div className="max-w-[95%] rounded-2xl rounded-bl-md border border-line bg-surface-2/50 px-4 py-3 text-[15px]">
                <RichAnswer text={entry.answer} sources={entry.sources} onSeek={onSeek} />
                <div className="mt-1 flex items-center gap-1">
                  <ReadAloudButton compact id={`qa-${entry.id}`} text={entry.answer.replace(/\[\d+\]/g, "").replace(/\*\*/g, "")} label="Read answer aloud" />
                </div>
                <Sources sources={entry.sources} onSeek={onSeek} />
              </div>
            </div>
          ))
        )}
        {pending && (
          <div className="space-y-3">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-ink">{pending}</div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm text-ink-2">
              <Spinner className="h-4 w-4" /> Searching the lecture…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="px-5 pb-2"><ErrorNote>{error}</ErrorNote></div>}
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3">
        {dictation.supported && (
          <button type="button" onClick={dictation.listening ? dictation.stop : dictation.start}
            className={`btn-icon h-10 w-10 ${dictation.listening ? "bg-bad/10 text-bad" : ""}`}
            title={dictation.listening ? "Stop dictation" : "Ask with your voice"} aria-label="Toggle voice input">
            {dictation.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
        <input className="input flex-1" placeholder={dictation.listening ? "Listening…" : "Ask a question about the lecture…"}
          value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} />
        <button className="btn-primary h-10 w-10 p-0" disabled={!question.trim() || !!pending} aria-label="Send">
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
