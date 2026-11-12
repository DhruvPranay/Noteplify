import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RunBars, StageBar } from "../components/charts";
import { EmptyState, ErrorNote, PageLoader } from "../components/ui";
import { useHealth } from "../hooks/useHealth";
import { api } from "../lib/api";
import { formatRelative, formatSeconds, percent } from "../lib/format";
import type { MetricsSummary } from "../lib/types";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-1.5 text-3xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

export function Metrics() {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const health = useHealth();
  const navigate = useNavigate();

  useEffect(() => {
    api.metrics().then(setData).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PageLoader />;

  const chronological = [...data.runs].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Pipeline metrics</h1>
        <p className="text-ink-2">
          Speed and accuracy of every lecture you've processed
          {health && <> · <span className="font-mono text-xs">{health.mock_ai ? "mock mode" : health.asr_model}</span></>}
        </p>
      </div>

      {data.runs.length === 0 ? (
        <div className="card">
          <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="No runs yet">
            Process a lecture and its timing breakdown will appear here.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Processing time per audio hour" value={data.avg_minutes_per_audio_hour != null ? `${data.avg_minutes_per_audio_hour.toFixed(1)} min` : "—"}
              hint={data.avg_rtf != null ? `RTF ${data.avg_rtf.toFixed(3)} · ${(1 / data.avg_rtf).toFixed(0)}× real time` : undefined} />
            <Stat label="Average WER" value={percent(data.avg_wer)}
              hint={data.wer_samples ? `across ${data.wer_samples} scored lecture${data.wer_samples === 1 ? "" : "s"}` : "score a lecture in its Metrics tab"} />
            <Stat label="Audio processed" value={`${data.audio_hours.toFixed(2)} h`} hint={`in ${formatSeconds(data.processing_hours * 3600)} of compute`} />
            <Stat label="Lectures" value={String(data.lectures_completed)}
              hint={`${data.lectures_total} total${data.lectures_failed ? ` · ${data.lectures_failed} failed` : ""}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="text-sm font-semibold">Processing minutes per audio hour</h2>
              <p className="mb-5 text-xs text-muted">One bar per lecture · hover for details, click to open</p>
              <RunBars
                unit="min / audio hr"
                onSelect={(id) => navigate(`/app/lectures/${id}?tab=metrics`)}
                data={chronological.map((r) => ({
                  id: r.lecture_id,
                  label: r.title,
                  value: r.minutes_per_audio_hour ?? 0,
                  detail: `${r.audio_minutes.toFixed(1)} min audio`,
                }))}
              />
            </section>
            <section className="card p-5">
              <h2 className="text-sm font-semibold">Share of processing time by stage</h2>
              <p className="mb-6 text-xs text-muted">All runs combined</p>
              <StageBar unit="share" values={data.stage_share} />
              <p className="mt-5 text-xs leading-relaxed text-ink-2">
                Transcription dominates for long recordings; it's parallelised across silence-aligned ≤30 s chunks, so raising
                <code className="mx-1 rounded bg-surface-2 px-1">ASR_CONCURRENCY</code> lowers minutes per audio hour.
              </p>
            </section>
          </div>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3 text-sm font-semibold">All runs</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface-2/60 text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Lecture</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Audio</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Processing</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Min / audio hr</th>
                    <th className="px-3 py-2.5 text-right font-semibold">WER</th>
                    <th className="px-5 py-2.5 text-right font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {data.runs.map((r) => (
                    <tr key={r.lecture_id} className="hover:bg-surface-2/40">
                      <td className="max-w-[280px] truncate px-5 py-2.5">
                        <Link to={`/app/lectures/${r.lecture_id}?tab=metrics`} className="font-medium hover:text-brand">{r.title}</Link>
                        <div className="text-xs text-muted">{r.transcribe_backend} · {r.asr_model}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{r.audio_minutes.toFixed(1)} min</td>
                      <td className="px-3 py-2.5 text-right">{formatSeconds(r.total_s)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{r.minutes_per_audio_hour?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right">{percent(r.wer)}</td>
                      <td className="px-5 py-2.5 text-right text-muted">{formatRelative(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
