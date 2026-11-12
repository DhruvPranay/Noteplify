import { FileAudio, Link2, Sparkles, UploadCloud, Youtube } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import type { Lecture } from "../lib/types";
import { useIndicator } from "./fx";
import { ErrorNote, ProgressBar } from "./ui";

const ACCEPT = ".mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.webm,.mp4,.mov,.mkv,.avi,audio/*,video/*";

export function UploadPanel({ onCreated }: { onCreated: (lecture: Lecture) => void }) {
  const [mode, setMode] = useState<"file" | "youtube">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const segRef = useRef<HTMLDivElement>(null);
  const indicator = useIndicator(segRef, mode);

  const reset = () => {
    setFile(null);
    setUrl("");
    setTitle("");
    setUploadPct(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const lecture =
        mode === "file" && file
          ? await api.upload(file, title, setUploadPct)
          : await api.createFromYouTube(url.trim(), title.trim() || undefined);
      reset();
      onCreated(lecture);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !busy && (mode === "file" ? Boolean(file) : url.trim().length > 8);

  return (
    <form onSubmit={submit} data-pointer className="card spotlight p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">New lecture</h2>
          <p className="text-sm text-ink-2">Upload a recording or paste a YouTube link.</p>
        </div>
        <div ref={segRef} className="seg" role="tablist">
          <span className="seg-indicator" style={indicator} aria-hidden />
          {(["file", "youtube"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} data-active={mode === m}
              onClick={() => setMode(m)} className="seg-item">
              {m === "file" ? <UploadCloud className="h-4 w-4" /> : <Youtube className="h-4 w-4" />}
              {m === "file" ? "Upload" : "YouTube"}
            </button>
          ))}
        </div>
      </div>

      <div key={mode} className="animate-fade-in">
        {mode === "file" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[20px] border-2 border-dashed px-4 py-10 text-center transition duration-500 ease-out-expo
              focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 ${
              dragging ? "scale-[1.01] border-brand bg-brand-soft" : "border-line hover:border-brand/50 hover:bg-surface-2/50"}`}
          >
            {dragging && <div aria-hidden className="bg-aurora absolute inset-0 opacity-10" />}
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <>
                <div className="bg-aurora mb-3 grid h-12 w-12 place-items-center rounded-2xl text-white shadow-glow">
                  <FileAudio className="h-6 w-6" />
                </div>
                <div className="max-w-full truncate text-sm font-semibold">{file.name}</div>
                <div className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB · click to change</div>
              </>
            ) : (
              <>
                <div className={`mb-3 grid h-12 w-12 place-items-center rounded-2xl transition duration-500 ease-spring ${
                  dragging ? "bg-aurora -translate-y-1 scale-110 text-white shadow-glow" : "bg-surface-2 text-ink-2 group-hover:-translate-y-1"}`}>
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold">{dragging ? "Drop it — we'll take it from here" : "Drop a lecture recording here"}</div>
                <div className="mt-0.5 text-xs text-muted">MP3, WAV, M4A, MP4, WebM… up to 500 MB</div>
              </>
            )}
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="yt-url">YouTube link</label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input id="yt-url" className="input h-12 pl-10" placeholder="https://www.youtube.com/watch?v=…" value={url}
                onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="lecture-title">Title <span className="font-normal text-muted">(optional)</span></label>
          <input id="lecture-title" className="input h-12" placeholder="e.g. CS229 — Lecture 3: Gradient descent"
            value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
        </div>
        <button className="btn-primary h-12 px-6" disabled={!canSubmit}>
          <Sparkles className="h-4 w-4" />
          {busy ? (uploadPct != null && uploadPct < 1 ? `Uploading ${Math.round(uploadPct * 100)}%` : "Starting…") : "Generate notes"}
        </button>
      </div>
      {busy && uploadPct != null && <div className="mt-3"><ProgressBar value={uploadPct} /></div>}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}
