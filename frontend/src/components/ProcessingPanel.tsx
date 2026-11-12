import { Check, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { STAGE_LABELS } from "../lib/format";
import type { Lecture } from "../lib/types";
import { Waveform } from "./fx";

const STEPS = ["downloading", "preprocessing", "transcribing", "indexing", "generating"];

function ProgressRing({ value }: { value: number }) {
  const gid = `ring-${useId().replace(/:/g, "")}`;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-36 w-36 shrink-0 place-items-center">
      <div aria-hidden className="bg-aurora absolute inset-4 rounded-full opacity-25 blur-2xl" />
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#4f46e5" />
            <stop offset="0.55" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#c026d3" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" className="stroke-surface-2" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke={`url(#${gid})`}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.02, value))}
          className="transition-[stroke-dashoffset] duration-1000 ease-out-expo" />
      </svg>
      <div className="relative text-center">
        <div className="font-display text-3xl font-semibold tabular-nums tracking-tight">{Math.round(value * 100)}%</div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">done</div>
      </div>
    </div>
  );
}

export function ProcessingPanel({ lecture, onRetry }: { lecture: Lecture; onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const failed = lecture.status === "failed";
  const current = STEPS.indexOf(lecture.stage ?? "");

  if (failed) {
    return (
      <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bad/10 text-bad">
          <XCircle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">Processing failed</h2>
          <p className="mt-1 break-words text-sm text-ink-2">{lecture.error}</p>
        </div>
        <button
          className="btn-primary"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            try {
              await onRetry();
            } finally {
              setRetrying(false);
            }
          }}
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="card relative overflow-hidden p-6 sm:p-8">
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
        <ProgressRing value={lecture.progress} />
        <div className="w-full min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Working on your lecture…</h2>
          <p className="mt-1 text-sm text-ink-2">
            {STAGE_LABELS[lecture.stage ?? "queued"] ?? "Queued"} — you can leave this page; processing continues in the background.
          </p>
          <Waveform bars={64} played={lecture.progress} className="mt-5 h-10" />
        </div>
      </div>

      <div className="relative mt-8">
      <div aria-hidden className="absolute left-[10%] right-[10%] top-[17px] hidden h-0.5 rounded-full bg-line sm:block">
        <div className="bg-aurora h-full rounded-full transition-[width] duration-1000 ease-out-expo"
          style={{ width: `${(Math.max(0, current) / (STEPS.length - 1)) * 100}%` }} />
      </div>
      <ol className="relative grid gap-3 sm:grid-cols-5">
        {STEPS.map((step, i) => {
          const done = current > i;
          const active = current === i;
          return (
            <li key={step} className={`relative flex items-center gap-3 text-sm sm:flex-col sm:gap-2 sm:text-center ${
              active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-muted"}`}>
              <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs transition duration-500 ${
                done ? "bg-aurora border-transparent text-white shadow-glow"
                  : active ? "border-brand bg-surface text-brand shadow-glow" : "border-line bg-surface"}`}>
                {active && <span aria-hidden className="pulse-ring absolute inset-0 rounded-full bg-brand/30" />}
                {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
              </span>
              {STAGE_LABELS[step]}
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}
