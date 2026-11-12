import { useState } from "react";
import { formatSeconds } from "../lib/format";

/** Pipeline stages in fixed order -> fixed categorical slots (color follows the stage, never its rank). */
export const STAGES = [
  { key: "download", label: "Download", color: "var(--series-1)" },
  { key: "preprocess", label: "Preprocess", color: "var(--series-2)" },
  { key: "transcribe", label: "Transcribe", color: "var(--series-3)" },
  { key: "index", label: "Index (RAG)", color: "var(--series-4)" },
  { key: "generate", label: "Notes", color: "var(--series-5)" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

interface StageBarProps {
  /** Either absolute seconds per stage, or shares that sum to 1. */
  values: Partial<Record<StageKey, number>>;
  unit: "seconds" | "share";
}

/** Single stacked bar showing where processing time goes, with legend + hover tooltip. */
export function StageBar({ values, unit }: StageBarProps) {
  const [hover, setHover] = useState<StageKey | null>(null);
  const total = STAGES.reduce((sum, s) => sum + (values[s.key] ?? 0), 0) || 1;
  const fmt = (v: number) => (unit === "seconds" ? formatSeconds(v) : `${(v * 100).toFixed(1)}%`);
  const items = STAGES.map((s) => ({ ...s, value: values[s.key] ?? 0, share: (values[s.key] ?? 0) / total }));
  const hovered = items.find((i) => i.key === hover);

  return (
    <div>
      <div className="relative">
        <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded" style={{ background: "var(--chart-surface)" }}>
          {items.filter((i) => i.share > 0).map((i) => (
            <div
              key={i.key}
              className="h-full cursor-default transition-opacity first:rounded-l last:rounded-r"
              style={{ width: `${i.share * 100}%`, minWidth: 3, background: i.color, opacity: hover && hover !== i.key ? 0.45 : 1 }}
              onMouseEnter={() => setHover(i.key)}
              onMouseLeave={() => setHover(null)}
              aria-label={`${i.label}: ${fmt(i.value)} (${(i.share * 100).toFixed(1)}%)`}
            />
          ))}
        </div>
        {hovered && (
          <div className="pointer-events-none absolute -top-11 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-card">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: hovered.color }} />
            <span className="font-semibold">{hovered.label}</span>
            <span className="ml-2 tabular-nums text-ink-2">{fmt(hovered.value)} · {(hovered.share * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {items.map((i) => (
          <li key={i.key} className="inline-flex items-center gap-1.5 text-ink-2"
            onMouseEnter={() => setHover(i.key)} onMouseLeave={() => setHover(null)}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
            {i.label}
            <span className="tabular-nums text-ink">{fmt(i.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BarDatum {
  id: number;
  label: string;
  value: number;
  detail: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

/** Vertical bars, one series (processing minutes per audio hour, per lecture). */
export function RunBars({ data, unit, onSelect }: { data: BarDatum[]; unit: string; onSelect?: (id: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const hovered = data.find((d) => d.id === hover);
  const tick = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative w-8 shrink-0 text-right text-[11px] tabular-nums" style={{ color: "var(--chart-muted)" }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `calc(${(t / max) * 100}% - 0px)` }}>{tick(t)}</span>
          ))}
        </div>
        <div className="relative h-48 flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px" style={{ bottom: `${(t / max) * 100}%`, background: t === 0 ? "var(--chart-axis)" : "var(--chart-grid)" }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] px-1">
            {data.map((d) => (
              <button
                key={d.id}
                type="button"
                className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
                style={{ maxWidth: 48 }}
                onMouseEnter={() => setHover(d.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(d.id)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(d.id)}
                aria-label={`${d.label}: ${d.value.toFixed(1)} ${unit}`}
              >
                <span
                  className="block w-full max-w-[28px] rounded-t transition-opacity"
                  style={{
                    height: `${Math.max((d.value / max) * 100, 1)}%`,
                    background: "var(--series-1)",
                    opacity: hover !== null && hover !== d.id ? 0.5 : 1,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-10 mt-1.5 text-[11px]" style={{ color: "var(--chart-muted)" }}>
        Oldest → newest run · {unit}
      </div>
      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-card">
          <div className="max-w-[240px] truncate font-semibold">{hovered.label}</div>
          <div className="tabular-nums text-ink-2">{hovered.value.toFixed(1)} {unit} · {hovered.detail}</div>
        </div>
      )}
    </div>
  );
}
