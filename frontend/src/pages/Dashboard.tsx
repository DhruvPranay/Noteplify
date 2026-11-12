import { GraduationCap, Search, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  return (
    <div>
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input h-11 pl-10 pr-20" placeholder="Search across all your lectures — e.g. “what is backpropagation”"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {busy && <Spinner className="h-4 w-4" />}
          {hits && (
            <button type="button" className="btn-icon h-7 w-7" aria-label="Clear search" onClick={() => { setHits(null); setQ(""); }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      {hits && (
        <div className="card mt-2 divide-y divide-line animate-fade-in">
          {hits.length === 0 ? (
            <p className="p-4 text-sm text-muted">No matches. Try different words.</p>
          ) : (
            hits.map((h) => (
              <Link key={h.chunk_id} to={`/app/lectures/${h.lecture_id}?t=${Math.floor(h.start)}`} className="block p-4 hover:bg-surface-2/60">
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Hi {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-ink-2">Add a lecture and Noteplify will take the notes for you.</p>
      </div>

      <UploadPanel onCreated={(l) => navigate(`/app/lectures/${l.id}`)} />

      {hasCompleted && <GlobalSearch />}

      <section>
        <h2 className="mb-4 text-lg font-bold">Your lectures</h2>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lectures.map((l) => <LectureCard key={l.id} lecture={l} />)}
          </div>
        )}
      </section>
    </div>
  );
}
