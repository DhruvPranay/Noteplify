import { Check, FileAudio, Volume2, Youtube } from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { cssVars, prefersReducedMotion, useInView, useScrollProgress, Waveform } from "../fx";

const d = (i: number) => cssVars({ "--d": i });

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`h-full w-full rounded-[30px] border border-line/70 bg-surface/70 p-5 shadow-device backdrop-blur-xl sm:p-7 ${className}`}>
      {children}
    </div>
  );
}

function ListenScene() {
  return (
    <Panel className="flex flex-col">
      <div className="seq flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3" style={d(0)}>
        <div className="bg-aurora grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-glow">
          <FileAudio className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">lecture-03-gradient-descent.mp3</div>
          <div className="text-xs text-muted">54.2 MB · 58:12</div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="fill-bar bg-aurora h-full w-0 rounded-full" />
          </div>
        </div>
      </div>
      <div className="seq my-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted" style={d(1)}>or</div>
      <div className="seq flex items-center gap-2.5 rounded-full border border-line bg-surface-2/60 px-4 py-3 text-sm" style={d(2)}>
        <Youtube className="h-4 w-4 shrink-0 text-[#ff4e45]" />
        <span className="typing truncate font-mono text-[13px] text-ink-2">youtube.com/watch?v=lecture-3</span>
      </div>
      <div className="seq mt-auto pt-6" style={d(3)}>
        <div className="mb-2 flex justify-between text-[11px] text-muted">
          <span>16 kHz mono · split at pauses</span>
          <span>≤ 30 s chunks</span>
        </div>
        <div className="relative">
          <Waveform bars={64} className="h-20" />
          {[17, 38, 56, 79].map((x) => (
            <span key={x} className="absolute inset-y-0 border-l border-dashed border-brand" style={{ left: `${x}%` }} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

const TRANSCRIPT: [string, string][] = [
  ["00:00", "Today we're going to talk about gradient descent."],
  ["00:07", "It's how most machine learning models actually learn."],
  ["00:15", "Picture standing on a hill in thick fog…"],
  ["00:24", "…taking small steps in the steepest downhill direction."],
];

function TranscribeScene() {
  return (
    <Panel className="flex flex-col">
      <div className="seq flex items-center justify-between" style={d(0)}>
        <span className="chip ring-1 ring-line">faster-whisper · small</span>
        <span className="text-xs tabular-nums text-muted">0.38× real-time</span>
      </div>
      <div className="seq relative mt-4 overflow-hidden rounded-2xl bg-surface-2/60 p-3" style={d(1)}>
        <Waveform bars={64} played={0.6} className="h-12" />
        <span className="scan" />
      </div>
      <ul className="mt-5 space-y-3">
        {TRANSCRIPT.map(([t, line], i) => (
          <li key={t} className="seq flex gap-3 text-sm" style={d(i + 2)}>
            <span className="ts h-fit shrink-0">{t}</span>
            <span className="text-ink-2">{line}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const DOTS: [number, number][] = [
  [22, 24], [38, 18], [30, 40], [52, 30], [64, 16], [70, 42], [46, 52], [26, 62], [58, 66], [78, 60], [40, 76], [68, 82],
];
const EDGES: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [2, 6], [6, 7], [6, 8], [5, 9], [8, 9], [7, 10], [8, 11], [10, 11]];

function Constellation() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      {EDGES.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={DOTS[a][0]} y1={DOTS[a][1]} x2={DOTS[b][0]} y2={DOTS[b][1]} className="stroke-brand/40" strokeWidth="0.5" />
      ))}
      {DOTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.6} className="fill-brand">
          <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2 + (i % 4) * 0.6}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

const NOTE_POINTS = ["Gradient points uphill — step the other way", "Learning rate sets the step size", "Mini-batches make each step cheap"];

function OrganizeScene() {
  return (
    <Panel className="grid gap-5 sm:grid-cols-[1.35fr_1fr]">
      <div>
        <div className="seq eyebrow text-[10px]" style={d(0)}>Section 1 · 00:00–14:20</div>
        <h4 className="seq mt-1.5 font-display text-xl font-semibold tracking-tight" style={d(1)}>Gradient descent, intuitively</h4>
        <p className="seq mt-2 text-sm leading-relaxed text-ink-2" style={d(2)}>
          Minimise the loss by repeatedly stepping in the direction of steepest descent.
        </p>
        <ul className="mt-4 space-y-2.5 text-sm">
          {NOTE_POINTS.map((p, i) => (
            <li key={p} className="seq flex gap-2" style={d(i + 3)}>
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="seq relative hidden min-h-[180px] rounded-2xl border border-line bg-surface-2/50 sm:block" style={d(2)}>
        <Constellation />
        <div className="absolute inset-x-0 bottom-3 text-center text-[11px] text-muted">384-d embeddings · pgvector</div>
      </div>
    </Panel>
  );
}

function StudyScene() {
  return (
    <Panel className="flex flex-col gap-4">
      <div className="seq auto-flip flip-card h-32" style={d(0)}>
        <div className="flip-inner relative h-full">
          <div className="flip-face absolute inset-0 flex flex-col justify-center rounded-2xl border border-line bg-surface-2 p-4 text-center">
            <div className="eyebrow text-[10px]">Question</div>
            <div className="mt-1.5 font-semibold">What does the learning rate control?</div>
          </div>
          <div className="flip-face flip-back bg-aurora absolute inset-0 flex flex-col justify-center rounded-2xl p-4 text-center text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">Answer</div>
            <div className="mt-1.5 text-sm">The size of each step taken down the gradient.</div>
          </div>
        </div>
      </div>
      <div className="seq bg-aurora ml-auto max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white" style={d(1)}>
        Why does the learning rate matter?
      </div>
      <div className="seq max-w-[90%] rounded-2xl rounded-bl-md border border-line bg-surface-2/70 px-4 py-3 text-sm leading-relaxed text-ink-2" style={d(2)}>
        Too large and the steps overshoot the minimum <span className="ts text-[10px]">[1]</span>; too small and
        training crawls <span className="ts text-[10px]">[2]</span>.
      </div>
      <div className="seq mt-auto flex items-center gap-2 text-xs text-muted" style={d(3)}>
        <Volume2 className="h-4 w-4 text-brand" /> Read aloud with the Web Speech API
      </div>
    </Panel>
  );
}

const STEPS: { key: string; eyebrow: string; title: string; body: string; Scene: ComponentType }[] = [
  {
    key: "listen", eyebrow: "01 · Add", title: "Drop in any lecture.",
    body: "Upload a recording up to 500 MB or paste a YouTube link. Audio is normalised to 16 kHz mono and split at natural pauses.",
    Scene: ListenScene,
  },
  {
    key: "transcribe", eyebrow: "02 · Transcribe", title: "Whisper hears every word.",
    body: "Silence-aware chunks of 30 seconds or less are transcribed in parallel, then stitched into one timestamped transcript.",
    Scene: TranscribeScene,
  },
  {
    key: "organize", eyebrow: "03 · Organize", title: "Notes that write themselves.",
    body: "An LLM turns each section into a heading, summary, key points and terms — and every passage is embedded for search.",
    Scene: OrganizeScene,
  },
  {
    key: "study", eyebrow: "04 · Study", title: "Quiz it. Ask it. Hear it.",
    body: "Flip auto-generated flashcards, ask questions answered with cited excerpts, or have any note read aloud.",
    Scene: StudyScene,
  },
];

/** Desktop: the section pins while you scroll and the stage morphs through the four steps. */
function StoryPinned() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useScrollProgress(
    ref,
    (r, vh) => -r.top / Math.max(1, r.height - vh),
    (p) => setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))),
  );

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <div ref={ref} className="relative hidden lg:block" style={{ height: `${STEPS.length * 85 + 60}vh` }}>
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[0.95fr_1.05fr] items-center gap-16 px-6">
          <div className="relative">
            <div className="absolute bottom-0 left-0 top-0 w-px bg-line">
              <div className="bg-aurora w-px" style={{ height: "calc(var(--p, 0) * 100%)" }} />
            </div>
            <ol className="space-y-9 pl-9">
              {STEPS.map((s, i) => (
                <li key={s.key}>
                  <button type="button" onClick={() => goTo(i)} aria-current={active === i ? "step" : undefined}
                    className={`text-left transition-opacity duration-500 ${active === i ? "opacity-100" : "opacity-30 hover:opacity-60"}`}>
                    <div className="eyebrow">{s.eyebrow}</div>
                    <div className="mt-2 font-display text-3xl font-semibold tracking-tight xl:text-4xl">{s.title}</div>
                    <div className={`grid transition-[grid-template-rows,opacity] duration-700 ease-out-expo ${active === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <p className="overflow-hidden pt-3 text-lg leading-relaxed text-ink-2">{s.body}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative aspect-[5/4] w-full">
            <div aria-hidden className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(124_58_237/0.28),transparent)] blur-2xl" />
            {STEPS.map(({ key, Scene }, i) => (
              <div key={key} data-active={active === i} aria-hidden={active !== i} className="scene absolute inset-0">
                <Scene />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryStep({ step }: { step: (typeof STEPS)[number] }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const { Scene } = step;
  return (
    <div ref={ref} className="mx-auto max-w-xl">
      <div className="eyebrow">{step.eyebrow}</div>
      <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight">{step.title}</h3>
      <p className="mt-3 text-ink-2">{step.body}</p>
      <div data-active={inView} className="scene mt-6 min-h-[340px]">
        <Scene />
      </div>
    </div>
  );
}

export function Story() {
  return (
    <>
      <StoryPinned />
      <div className="space-y-20 px-4 sm:px-6 lg:hidden">
        {STEPS.map((s) => <StoryStep key={s.key} step={s} />)}
      </div>
    </>
  );
}
