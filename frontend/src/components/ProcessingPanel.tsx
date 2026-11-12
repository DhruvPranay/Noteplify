import { Check, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { STAGE_LABELS } from "../lib/format";
import type { Lecture } from "../lib/types";
import { ProgressBar } from "./ui";

const STEPS = ["downloading", "preprocessing", "transcribing", "indexing", "generating"];

export function ProcessingPanel({ lecture, onRetry }: { lecture: Lecture; onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const failed = lecture.status === "failed";
  const current = STEPS.indexOf(lecture.stage ?? "");

  return (
    <div className="card p-6 sm:p-8">
      {failed ? (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bad/10 text-bad">
            <XCircle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold">Processing failed</h2>
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
      ) : (
        <>
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Working on your lecture…</h2>
            <span className="text-sm font-semibold tabular-nums text-brand">{Math.round(lecture.progress * 100)}%</span>
          </div>
          <p className="mb-5 text-sm text-ink-2">
            You can leave this page — processing continues in the background.
          </p>
          <ProgressBar value={lecture.progress} />
          <ol className="mt-6 grid gap-3 sm:grid-cols-5">
            {STEPS.map((step, i) => {
              const done = current > i;
              const active = current === i;
              return (
                <li key={step} className={`flex items-center gap-2 text-sm sm:flex-col sm:text-center ${active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-muted"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    done ? "border-brand bg-brand text-brand-ink" : active ? "border-brand text-brand" : "border-line"}`}>
                    {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
                  </span>
                  {STAGE_LABELS[step]}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
