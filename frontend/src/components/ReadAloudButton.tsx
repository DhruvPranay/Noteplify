import { Pause, Play, Square, Volume2 } from "lucide-react";
import { useSpeech } from "../context/SpeechContext";

interface Props {
  id: string;
  text: string;
  label?: string;
  compact?: boolean;
}

/** Toggle read-aloud for a block of text (Web Speech API). */
export function ReadAloudButton({ id, text, label = "Read aloud", compact = false }: Props) {
  const { supported, activeId, paused, toggle, stop } = useSpeech();
  if (!supported) return null;
  const active = activeId === id;

  if (compact) {
    return (
      <button
        type="button"
        className={`btn-icon h-8 w-8 ${active ? "bg-brand-soft text-brand" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (active) stop();
          else toggle(id, text);
        }}
        title={active ? "Stop reading" : label}
        aria-label={active ? "Stop reading" : label}
      >
        {active ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" className={`btn-ghost py-2 ${active ? "border-brand/40 text-brand" : ""}`} onClick={() => toggle(id, text)}>
        {active ? (paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />) : <Volume2 className="h-4 w-4" />}
        {active ? (paused ? "Resume" : "Pause") : label}
      </button>
      {active && (
        <button type="button" className="btn-icon" onClick={stop} aria-label="Stop reading" title="Stop">
          <Square className="h-4 w-4" />
        </button>
      )}
    </span>
  );
}

export function SpeechRateControl() {
  const { supported, rate, setRate } = useSpeech();
  if (!supported) return null;
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted">
      Voice speed
      <select className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink" value={rate}
        onChange={(e) => setRate(Number(e.target.value))}>
        {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
          <option key={r} value={r}>{r}×</option>
        ))}
      </select>
    </label>
  );
}
