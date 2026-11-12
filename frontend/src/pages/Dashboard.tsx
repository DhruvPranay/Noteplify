import { GraduationCap, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Reveal } from "../components/fx";
import { LectureCard } from "../components/LectureCard";
import { UploadPanel } from "../components/UploadPanel";
import { EmptyState, ErrorNote, PageLoader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatTimestamp } from "../lib/format";
import type { LectureListItem, Source } from "../lib/types";

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Source[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setHits((await api.search(q.trim())).hits);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  // "/" or Ctrl/⌘+K focuses search, like a command bar.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <form onSubmit={submit} className="group relative">
        <div aria-hidden className="bg-aurora absolute -inset-px rounded-full opacity-0 blur-md transition-opacity duration-500 group-focus-within:opacity-40" />
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
        <input ref={inputRef} className="input relative h-12 rounded-full pl-11 pr-24" placeholder="Search across all your lectures — e.g. “what is backpropagation”"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="absolute right-2.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
          {busy && <Spinner className="h-4 w-4" />}
          {hits ? (
            <button type="button" className="btn-icon h-7 w-7" aria-label="Clear search" onClick={() => { setHits(null); setQ(""); }}>
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-muted sm:inline">Ctrl K</kbd>
          )}
        </div>
      </form>
      {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      {hits && (
        <div className="card mt-3 divide-y divide-line/70 overflow-hidden animate-fade-in">
          {hits.length === 0 ? (
            <p className="p-4 text-sm text-muted">No matches. Try different words.</p>
          ) : (
            hits.map((h) => (
              <Link key={h.chunk_id} to={`/app/lectures/${h.lecture_id}?t=${Math.floor(h.start)}`} className="block p-4 transition hover:bg-surface-2/60">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{h.lecture_title}</span>
                  <span className="ts">{formatTimestamp(h.start)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-ink-2">{h.text}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState<LectureListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.lectures().then(setLectures).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  // Poll while anything is still processing.
  const busy = lectures?.some((l) => l.status === "queued" || l.status === "processing");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [busy, load]);

  const hasCompleted = lectures?.some((l) => l.status === "completed");

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Burning the midnight oil" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-10">
      <div>
        <p className="rise-in text-sm font-medium text-muted">{greeting}, {user?.name?.split(" ")[0]}.</p>
        <h1 className="rise-in mt-1 font-display text-4xl font-semibold tracking-[-0.035em] sm:text-5xl" style={{ animationDelay: "80ms" }}>
          What are we <span className="text-gradient">learning today?</span>
        </h1>
      </div>

      <div className="rise-in" style={{ animationDelay: "160ms" }}>
        <UploadPanel onCreated={(l) => navigate(`/app/lectures/${l.id}`)} />
      </div>

      {hasCompleted && <GlobalSearch />}

      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Your lectures</h2>
          {lectures && lectures.length > 0 && <span className="text-sm text-muted">{lectures.length} total</span>}
        </div>
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : !lectures ? (
          <PageLoader />
        ) : lectures.length === 0 ? (
          <div className="card">
            <EmptyState icon={<GraduationCap className="h-6 w-6" />} title="No lectures yet">
              Upload your first recording above — a 1-hour lecture usually takes just a few minutes.
            </EmptyState>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lectures.map((l, i) => (
              <Reveal key={l.id} delay={Math.min(i, 8) * 70}>
                <LectureCard lecture={l} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
