import { Gauge, Search, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal, Waveform } from "../fx";

function Tile({ className = "", eyebrow, title, body, children, delay = 0 }: {
  className?: string; eyebrow: string; title: string; body: string; children?: ReactNode; delay?: number;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <div data-pointer
        className="spotlight group relative flex h-full flex-col overflow-hidden rounded-[30px] border border-line/70 bg-surface/60 p-6 backdrop-blur-xl transition-colors duration-500 hover:border-line sm:p-8">
        <div className="eyebrow">{eyebrow}</div>
        <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h3>
        <p className="mt-2 max-w-md text-ink-2">{body}</p>
        {children && <div className="mt-auto pt-8">{children}</div>}
      </div>
    </Reveal>
  );
}

export function Bento() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
      <Tile className="md:col-span-4" eyebrow="Transcription" title="Whisper, cut at the pauses."
        body="Audio is split at natural silences into chunks of 30 seconds or less, transcribed in parallel and stitched back with timestamps.">
        <div className="relative rounded-2xl border border-line/70 bg-surface-2/50 p-4">
          <Waveform bars={72} played={0.55} className="h-16" />
          <div className="mt-3 flex flex-wrap gap-2">
            {["00:00", "00:28", "00:57", "01:24", "01:51"].map((t) => <span key={t} className="ts">{t}</span>)}
          </div>
        </div>
      </Tile>

      <Tile className="md:col-span-2" delay={80} eyebrow="Read aloud" title="Listen to anything."
        body="Notes, answers and flashcards are read out by your browser's Web Speech API.">
        <div className="relative mx-auto grid h-28 w-28 place-items-center">
          <span className="pulse-ring absolute inset-0 rounded-full bg-brand/30" />
          <span className="pulse-ring absolute inset-0 rounded-full bg-brand/20" style={{ animationDelay: "1.2s" }} />
          <span className="bg-aurora relative grid h-16 w-16 place-items-center rounded-full text-white shadow-glow">
            <Volume2 className="h-7 w-7" />
          </span>
        </div>
      </Tile>

      <Tile className="md:col-span-2" eyebrow="Ask the lecture" title="Answers with receipts."
        body="Every answer cites the transcript excerpts it came from — click one to jump there.">
        <div className="space-y-2 text-sm">
          <div className="bg-aurora ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-white">What's a local minimum?</div>
          <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-surface-2/70 px-3.5 py-2 text-ink-2">
            A point lower than its neighbours, but not the lowest overall <span className="ts text-[10px]">[1]</span>
          </div>
        </div>
      </Tile>

      <Tile className="md:col-span-2" delay={80} eyebrow="Flashcards" title="Active recall, built in."
        body="Flip, shuffle and re-study the cards you missed. Hover to fan the deck.">
        <div className="fan relative mx-auto h-28 w-40">
          {["Gradient", "Learning rate", "Local minimum"].map((t, i) => (
            <div key={t}
              className={`absolute inset-0 flex items-center justify-center rounded-2xl border border-line p-3 text-center text-sm font-semibold shadow-card ${
                i === 2 ? "bg-aurora text-white" : "bg-surface"}`}>
              {t}
            </div>
          ))}
        </div>
      </Tile>

      <Tile className="md:col-span-2" delay={160} eyebrow="Hybrid search" title="Meaning and keywords."
        body="pgvector similarity and Postgres full-text search, fused with reciprocal rank fusion.">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1.5">vector</span>
          <span className="text-muted">+</span>
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1.5">keyword</span>
          <span className="text-muted">→</span>
          <span className="bg-aurora inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-white shadow-glow">
            <Search className="h-3.5 w-3.5" /> RRF
          </span>
        </div>
      </Tile>

      <Tile className="md:col-span-3" eyebrow="Structured notes" title="Every section, linked to the second."
        body="Headings, summaries, key points and definitions — each one a click away from the moment it was said.">
        <div className="space-y-2">
          {[["1. Gradient descent, intuitively", "00:00"], ["2. Choosing a learning rate", "14:20"], ["3. Stochastic & mini-batch updates", "31:05"]].map(([t, ts]) => (
            <div key={t} className="flex items-center justify-between gap-3 rounded-2xl border border-line/70 bg-surface-2/50 px-4 py-2.5 text-sm transition duration-500 ease-out-expo group-hover:translate-x-1">
              <span className="truncate font-medium">{t}</span>
              <span className="ts shrink-0">{ts}</span>
            </div>
          ))}
        </div>
      </Tile>

      <Tile className="md:col-span-3" delay={80} eyebrow="Metrics" title="Measured, not guessed."
        body="Every run records per-stage timing and minutes of processing per audio hour; accuracy is scored with word error rate.">
        <div className="space-y-2.5">
          {[["Transcribe", 70], ["Generate notes", 15], ["Prep + index", 15]].map(([label, pct]) => (
            <div key={label} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 text-ink-2">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="bg-aurora h-full rounded-full transition-[width] duration-1000 ease-out-expo" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums text-muted">{pct}%</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted"><Gauge className="h-3.5 w-3.5" /> share of processing time, sample run</div>
        </div>
      </Tile>
    </div>
  );
}
