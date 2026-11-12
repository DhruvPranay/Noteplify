import { FileAudio, Link2, UploadCloud, Youtube } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import type { Lecture } from "../lib/types";
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
    <form onSubmit={submit} className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">New lecture</h2>
          <p className="text-sm text-ink-2">Upload a recording or paste a YouTube link.</p>
        </div>
        <div className="inline-flex rounded-xl bg-surface-2 p-1" role="tablist">
          {(["file", "youtube"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}>
              {m === "file" ? <UploadCloud className="h-4 w-4" /> : <Youtube className="h-4 w-4" />}
              {m === "file" ? "Upload" : "YouTube"}
            </button>
          ))}
        </div>
      </div>

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
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50 hover:bg-surface-2"}`}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <>
              <FileAudio className="mb-2 h-8 w-8 text-brand" />
              <div className="max-w-full truncate text-sm font-semibold">{file.name}</div>
              <div className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB · click to change</div>
            </>
          ) : (
            <>
              <UploadCloud className="mb-2 h-8 w-8 text-muted" />
              <div className="text-sm font-semibold">Drop a lecture recording here</div>
              <div className="text-xs text-muted">MP3, WAV, M4A, MP4, WebM… up to 500 MB</div>
            </>
          )}
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="yt-url">YouTube link</label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input id="yt-url" className="input pl-9" placeholder="https://www.youtube.com/watch?v=…" value={url}
              onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="lecture-title">Title <span className="font-normal text-muted">(optional)</span></label>
          <input id="lecture-title" className="input" placeholder="e.g. CS229 — Lecture 3: Gradient descent"
            value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
        </div>
        <button className="btn-primary h-[42px]" disabled={!canSubmit}>
          {busy ? (uploadPct != null && uploadPct < 1 ? `Uploading ${Math.round(uploadPct * 100)}%` : "Starting…") : "Generate notes"}
        </button>
      </div>
      {busy && uploadPct != null && <div className="mt-3"><ProgressBar value={uploadPct} /></div>}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
    </form>
  );
}
