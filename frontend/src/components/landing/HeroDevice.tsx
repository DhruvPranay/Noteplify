import { MessageSquareText, Play, Sparkles } from "lucide-react";
import { useRef } from "react";
import { useScrollProgress, Waveform } from "../fx";

const LINES: [string, string][] = [
  ["21:48", "So every update moves the weights a little bit downhill."],
  ["22:04", "The learning rate decides how big each of those steps is."],
  ["22:17", "Too large and you overshoot; too small and training crawls."],
];

const POINTS = [
  "The gradient points uphill — step the opposite way.",
  "Learning rate = the size of each step.",
  "Stochastic updates trade accuracy for speed.",
];

/** Glass "app window" that starts tilted back and settles flat as you scroll. */
export function HeroDevice({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollProgress(ref, (_r, vh) => window.scrollY / (vh * 0.65));

  return (
    <div ref={ref} className={`mx-auto w-full max-w-5xl px-4 sm:px-6 ${className}`}>
      <div className="rise-in relative" style={{ animationDelay: "900ms" }}>
        <div className="hero-device relative rounded-[26px] border border-white/10 bg-white/[0.04] p-1.5 shadow-device backdrop-blur-xl sm:rounded-[32px] sm:p-2">
          <div className="overflow-hidden rounded-[20px] border border-white/5 bg-surface text-left sm:rounded-[26px]">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <div className="mx-auto truncate rounded-full bg-surface-2 px-4 py-1 text-[11px] text-muted">
                Noteplify · Gradient descent, explained
              </div>
              <span className="w-10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr]">
              <div className="hidden border-r border-line p-6 md:block">
                <div className="eyebrow text-[10px]">Lecture 3 · Machine learning</div>
                <div className="mt-1 font-display text-xl font-semibold tracking-tight">Gradient descent, explained</div>
                <div className="mt-5 rounded-2xl bg-surface-2/70 p-4">
                  <Waveform bars={56} played={0.38} className="h-14" />
                  <div className="mt-3 flex items-center justify-between text-[11px] tabular-nums text-muted">
                    <span className="inline-flex items-center gap-2">
                      <span className="bg-aurora grid h-7 w-7 place-items-center rounded-full text-white shadow-glow">
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                      22:04
                    </span>
                    <span>58:12</span>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 text-[13px]">
                  {LINES.map(([t, text], i) => (
                    <li key={t} className={`flex gap-2.5 rounded-xl p-2 ${i === 1 ? "bg-brand-soft" : ""}`}>
                      <span className="ts h-fit shrink-0">{t}</span>
                      <span className={i === 1 ? "text-ink" : "text-ink-2"}>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5 sm:p-6">
                <div className="inline-flex rounded-full bg-surface-2 p-1 text-[12px] font-medium">
                  <span className="bg-aurora rounded-full px-3 py-1 text-white">Notes</span>
                  <span className="px-3 py-1 text-ink-2">Flashcards</span>
                  <span className="px-3 py-1 text-ink-2">Ask AI</span>
                </div>
                <div className="mt-5 flex items-baseline justify-between gap-3">
                  <h3 className="font-display font-semibold tracking-tight">1. Gradient descent, intuitively</h3>
                  <span className="ts shrink-0">00:00</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                  Gradient descent minimises a loss by repeatedly stepping in the direction of steepest descent —
                  like walking downhill in thick fog.
                </p>
                <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Key points</div>
                <ul className="mt-2 space-y-2 text-[13px]">
                  {POINTS.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <span className="bg-aurora mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-2xl border border-line p-3 text-[12px] text-ink-2">
                  <span className="font-semibold text-ink">Learning rate</span> — the step size taken on each update.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -left-10 bottom-16 hidden w-64 lg:block">
          <div className="float-y glass rounded-3xl p-4 shadow-device">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              <Sparkles className="h-3 w-3" /> Flashcard 4 of 18
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug">What does the learning rate control?</p>
            <p className="mt-2 text-xs text-muted">Press Space to flip</p>
          </div>
        </div>
        <div className="absolute -right-10 top-20 hidden w-72 lg:block">
          <div className="float-y glass rounded-3xl p-4 shadow-device" style={{ animationDelay: "-3.5s" }}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              <MessageSquareText className="h-3 w-3" /> Ask AI
            </div>
            <p className="mt-2 text-sm leading-snug text-ink-2">
              A large learning rate overshoots the minimum
              <span className="ts mx-1 align-middle text-[10px]">[2]</span>
              while a small one converges slowly
              <span className="ts ml-1 align-middle text-[10px]">[3]</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
