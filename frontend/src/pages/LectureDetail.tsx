import { ArrowLeft, BarChart3, BookOpen, Check, Layers, MessageSquareText, Pencil, ScrollText, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AskView } from "../components/AskView";
import { FlashcardsView } from "../components/FlashcardsView";
import { useIndicator } from "../components/fx";
import { LectureMetrics } from "../components/LectureMetrics";
import { NotesView } from "../components/NotesView";
import { Player, type PlayerHandle } from "../components/Player";
import { ProcessingPanel } from "../components/ProcessingPanel";
import { SpeechRateControl } from "../components/ReadAloudButton";
import { TranscriptView } from "../components/TranscriptView";
import { ErrorNote, PageLoader, StatusBadge } from "../components/ui";
import { useSpeech } from "../context/SpeechContext";
import { api } from "../lib/api";
import { formatDuration, formatRelative } from "../lib/format";
import type { Lecture } from "../lib/types";

const TABS = [
  { key: "notes", label: "Notes", icon: BookOpen },
  { key: "flashcards", label: "Flashcards", icon: Layers },
  { key: "transcript", label: "Transcript", icon: ScrollText },
  { key: "ask", label: "Ask AI", icon: MessageSquareText },
  { key: "metrics", label: "Metrics", icon: BarChart3 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function LectureDetail() {
  const { id } = useParams();
  const lectureId = Number(id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const player = useRef<PlayerHandle>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const { stop } = useSpeech();

  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "notes") as TabKey;
  const indicator = useIndicator(tabsRef, `${tab}-${lecture?.status}-${lecture?.flashcard_count}`);
  const setTab = (key: TabKey) => {
    const next = new URLSearchParams(params);
    next.set("tab", key);
    next.delete("t");
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    api.lecture(lectureId).then(setLecture).catch((e: Error) => setError(e.message));
  }, [lectureId]);

  useEffect(load, [load]);
  useEffect(() => stop, [stop]); // stop reading aloud when leaving the page

  const processing = lecture?.status === "queued" || lecture?.status === "processing";
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [processing, load]);

  // Deep link from search results: /app/lectures/3?t=125
  const startAt = params.get("t");
  useEffect(() => {
    if (lecture?.status === "completed" && startAt) {
      const timer = setTimeout(() => player.current?.seek(Number(startAt)), 600);
      return () => clearTimeout(timer);
    }
  }, [lecture?.status, startAt]);

  const seek = (t: number) => player.current?.seek(t);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!lecture) return <PageLoader />;

  const saveTitle = async () => {
    if (title.trim() && title.trim() !== lecture.title) setLecture(await api.rename(lecture.id, title.trim()));
    setEditing(false);
  };

  const remove = async () => {
    if (!confirm(`Delete “${lecture.title}”? This removes its notes, flashcards and transcript.`)) return;
    await api.remove(lecture.id);
    navigate("/app");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/app" className="group inline-flex items-center gap-1 text-sm font-medium text-ink-2 transition hover:text-ink">
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" /> All lectures
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input className="input text-lg font-bold" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") void saveTitle(); if (e.key === "Escape") setEditing(false); }} />
                <button className="btn-icon" onClick={() => void saveTitle()} aria-label="Save title"><Check className="h-4 w-4" /></button>
                <button className="btn-icon" onClick={() => setEditing(false)} aria-label="Cancel"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">{lecture.title}</h1>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusBadge status={lecture.status} />
              <span>{formatDuration(lecture.duration_s)}</span>
              <span>·</span>
              <span>{lecture.source_type === "youtube" ? "YouTube" : lecture.original_filename}</span>
              <span>·</span>
              <span>{formatRelative(lecture.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!editing && (
              <button className="btn-icon" onClick={() => { setTitle(lecture.title); setEditing(true); }} title="Rename" aria-label="Rename">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button className="btn-icon hover:text-bad" onClick={() => void remove()} title="Delete" aria-label="Delete lecture">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {lecture.status !== "completed" ? (
        <>
          <ProcessingPanel lecture={lecture} onRetry={async () => setLecture(await api.retry(lecture.id))} />
          {lecture.youtube_id && <div className="max-w-xl"><Player ref={player} lecture={lecture} /></div>}
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="mb-6 max-w-full overflow-x-auto">
              <div ref={tabsRef} className="seg seg-vivid" role="tablist">
                <span className="seg-indicator" style={indicator} aria-hidden />
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} role="tab" aria-selected={tab === key} data-active={tab === key} onClick={() => setTab(key)}
                    className="seg-item py-2 font-semibold">
                    <Icon className="h-4 w-4" /> {label}
                    {key === "flashcards" && lecture.flashcard_count > 0 && (
                      <span className={`rounded-full px-1.5 text-[11px] transition-colors ${tab === key ? "bg-white/25" : "bg-surface-2"}`}>{lecture.flashcard_count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div key={tab} className="animate-fade-in">
              {tab === "notes" && <NotesView lecture={lecture} onSeek={seek} />}
              {tab === "flashcards" && <FlashcardsView lectureId={lecture.id} />}
              {tab === "transcript" && <TranscriptView lectureId={lecture.id} onSeek={seek} />}
              {tab === "ask" && <AskView lecture={lecture} onSeek={seek} />}
              {tab === "metrics" && <LectureMetrics lecture={lecture} onUpdated={load} />}
            </div>
          </div>
          <aside className="order-first space-y-4 lg:order-none">
            <div className="space-y-4 lg:sticky lg:top-24">
              <Player ref={player} lecture={lecture} />
              <div className="card hidden p-4 text-sm lg:block">
                <div className="mb-2 font-semibold">Study tips</div>
                <ul className="space-y-1.5 text-ink-2">
                  <li>Click any <span className="ts pointer-events-none">00:00</span> chip to jump to that moment.</li>
                  <li>Press <kbd className="rounded border border-line px-1 text-xs">Space</kbd> to flip flashcards.</li>
                  <li>Use the mic in Ask AI to ask by voice.</li>
                </ul>
                <div className="mt-3 border-t border-line pt-3"><SpeechRateControl /></div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
