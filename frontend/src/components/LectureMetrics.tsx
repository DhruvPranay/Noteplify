import { FileText, Gauge, Timer, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { formatSeconds, percent } from "../lib/format";
import type { Lecture, WerResult } from "../lib/types";
import { StageBar } from "./charts";
import { ErrorNote } from "./ui";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

export function LectureMetrics({ lecture, onUpdated }: { lecture: Lecture; onUpdated: () => void }) {
  const m = lecture.metric;
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WerResult | null>(m?.wer_details ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!m) return <p className="text-sm text-muted">Metrics are recorded once processing finishes.</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api.wer(lecture.id, reference));
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't compute WER.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total processing" value={formatSeconds(m.total_s)} hint={`for ${formatSeconds(m.audio_duration_s)} of audio`} />
        <Tile label="Minutes per audio hour" value={m.minutes_per_audio_hour?.toFixed(1) ?? "—"} hint="lower is faster" />
        <Tile label="Real-time factor" value={m.rtf != null ? `${m.rtf.toFixed(3)}×` : "—"} hint={m.rtf ? `${(1 / m.rtf).toFixed(0)}× faster than real time` : undefined} />
        <Tile label="Word error rate" value={percent(m.wer)} hint={m.wer == null ? "add a reference below" : "vs. your reference"} />
      </div>

      <section className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Timer className="h-4 w-4 text-brand" /> Where the time went</h3>
        <StageBar unit="seconds" values={{
          download: m.download_s, preprocess: m.preprocess_s, transcribe: m.transcribe_s, index: m.index_s, generate: m.generate_s,
        }} />
        <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Speech model", m.asr_model],
            ["Transcription backend", m.transcribe_backend],
            ["Notes LLM", m.llm_model],
            ["Embedding model", m.embedding_model],
            ["Audio chunks", String(m.num_audio_chunks)],
            ["RAG chunks indexed", String(m.num_rag_chunks)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
              <dt className="text-muted">{k}</dt>
              <dd className="truncate text-right font-medium" title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <form onSubmit={submit} className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-brand" /> Measure transcription accuracy (WER)</h3>
        <p className="mb-3 mt-1 text-sm text-ink-2">
          Paste a human-made transcript of this lecture (e.g. official captions). Both texts are lower-cased and stripped of
          punctuation, then aligned word-by-word.
        </p>
        <textarea className="input min-h-[120px] font-mono text-xs" placeholder="Reference transcript…" value={reference}
          onChange={(e) => setReference(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setReference(await f.text());
            }} />
          <button type="button" className="btn-ghost py-2" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Load .txt
          </button>
          <button className="btn-primary py-2" disabled={busy || !reference.trim()}>
            <FileText className="h-4 w-4" /> {busy ? "Computing…" : "Compute WER"}
          </button>
        </div>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
        {result && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="WER" value={percent(result.wer, 2)} hint={`${result.reference_words.toLocaleString()} reference words`} />
            <Tile label="Substitutions" value={result.substitutions.toLocaleString()} />
            <Tile label="Deletions" value={result.deletions.toLocaleString()} />
            <Tile label="Insertions" value={result.insertions.toLocaleString()} />
          </div>
        )}
      </form>
    </div>
  );
}
