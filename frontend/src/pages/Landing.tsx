import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aurora, CountUp, Reveal, WordReveal } from "../components/fx";
import { Bento } from "../components/landing/Bento";
import { HeroDevice } from "../components/landing/HeroDevice";
import { ScrubText } from "../components/landing/ScrubText";
import { Story } from "../components/landing/Story";
import { Logo } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const STATS = [
  { value: 4.26, decimals: 2, suffix: "%", label: "Word error rate", body: "faster-whisper small, scored against the reference transcript." },
  { value: 0.38, decimals: 2, suffix: "×", label: "Real-time factor", body: "93 s of audio processed end to end in 36 s, on a laptop CPU." },
  { value: 5, decimals: 0, suffix: "", label: "Timed pipeline stages", body: "Download, preprocess, transcribe, index and generate." },
  { value: 2, decimals: 0, suffix: "", label: "Retrieval signals", body: "Vector similarity and full-text search, fused with RRF." },
];

const STACK = ["FastAPI", "PostgreSQL", "pgvector", "Whisper", "faster-whisper", "Hugging Face", "Llama 3", "Ollama",
  "React", "TypeScript", "Tailwind CSS", "Web Speech API", "Docker"];

/** The marketing page is always dark (like a product launch page); the app follows the system. */
function useForcedDark() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-dark");
    return () => root.classList.remove("theme-dark");
  }, []);
}

function SiteNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-500 ${
      scrolled ? "border-line/60 bg-bg/65 backdrop-blur-2xl backdrop-saturate-150" : "border-transparent"}`}>
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Noteplify home"><Logo size={24} /></Link>
        <nav className="hidden items-center gap-8 text-[13px] text-ink-2 md:flex">
          <a href="#story" className="transition hover:text-ink">How it works</a>
          <a href="#features" className="transition hover:text-ink">Features</a>
          <a href="#numbers" className="transition hover:text-ink">Numbers</a>
        </nav>
        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <Link to="/app" className="btn-primary px-4 py-1.5 text-[13px]">Open app</Link>
          ) : (
            <>
              <Link to="/login" className="rounded-full px-3 py-1.5 text-[13px] text-ink-2 transition hover:text-ink">Sign in</Link>
              <Link to="/register" className="btn-primary px-4 py-1.5 text-[13px]">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Landing() {
  useForcedDark();
  const { user } = useAuth();
  const cta = user ? "/app" : "/register";

  return (
    <div className="min-h-screen overflow-x-clip bg-bg text-ink">
      <SiteNav signedIn={Boolean(user)} />

      {/* Hero */}
      <section data-pointer className="relative isolate flex min-h-[100svh] flex-col items-center overflow-hidden pb-24 pt-28 sm:pt-36">
        <Aurora />
        <div className="grid-overlay" aria-hidden />
        <div className="pointer-glow" aria-hidden />
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6">
          <Link to={cta}
            className="rise-in group inline-flex items-center gap-2 rounded-full border border-line/80 bg-surface/50 py-1.5 pl-2 pr-3.5 text-[13px] text-ink-2 backdrop-blur-xl transition hover:border-brand/50 hover:text-ink">
            <span className="bg-aurora inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">
              <Sparkles className="h-3 w-3" /> New
            </span>
            Free local AI mode — runs on your own machine
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <h1 className="mt-8 font-display text-[clamp(2.9rem,8.5vw,6.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
            <WordReveal text="Every lecture." delay={150} step={110} />
            <span className="rise-in text-gradient block pb-2" style={{ animationDelay: "420ms" }}>Instantly understood.</span>
          </h1>
          <p className="rise-in mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2 sm:text-xl" style={{ animationDelay: "620ms" }}>
            Drop in a recording or a YouTube link. Noteplify transcribes it with Whisper, then writes notes, flashcards
            and answers — each linked to the exact second it was said.
          </p>
          <div className="rise-in mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4" style={{ animationDelay: "780ms" }}>
            <Link to={cta} className="btn-primary btn-lg">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#story" className="group inline-flex items-center gap-1 text-base font-medium text-brand">
              See how it works <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
        <HeroDevice className="relative z-10 mt-16 sm:mt-24" />
      </section>

      {/* Scroll-scrubbed manifesto */}
      <section className="mx-auto max-w-5xl px-4 py-28 sm:px-6 sm:py-40">
        <ScrubText
          className="font-display text-[clamp(1.9rem,4.6vw,3.6rem)] font-semibold leading-[1.12] tracking-[-0.03em]"
          text="An hour-long lecture holds about nine thousand words. You need maybe nine hundred of them. Noteplify finds those, organizes them, and links every single one back to the moment it was said." />
      </section>

      {/* Pinned story */}
      <section id="story" className="relative">
        <Reveal className="mx-auto mb-12 max-w-3xl px-4 text-center sm:px-6 lg:mb-0">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">From sound to understanding.</h2>
        </Reveal>
        <Story />
      </section>

      {/* Bento features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-36">
        <Reveal className="mb-14 max-w-2xl">
          <div className="eyebrow">Features</div>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
            Everything a lecture needs. <span className="text-muted">Nothing it doesn't.</span>
          </h2>
        </Reveal>
        <Bento />
      </section>

      {/* Numbers */}
      <section id="numbers" className="relative mx-auto max-w-6xl px-4 pb-28 sm:px-6 sm:pb-36">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="eyebrow">Numbers</div>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">Measured on every run.</h2>
          <p className="mt-4 text-lg text-ink-2">Each lecture records per-stage timing, and transcripts can be scored with word error rate.</p>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[30px] border border-line/70 bg-line/70 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-bg p-8">
              <div className="text-gradient font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                <CountUp value={s.value} decimals={s.decimals} suffix={s.suffix} />
              </div>
              <div className="mt-4 font-semibold">{s.label}</div>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-muted">
          Measured on the bundled 93-second benchmark sample (Local AI mode, laptop CPU, models warm).
        </p>
      </section>

      {/* Stack marquee */}
      <section className="border-y border-line/60 py-10" aria-label="Built with">
        <div className="marquee">
          <div className="marquee-track">
            {[...STACK, ...STACK].map((s, i) => (
              <span key={i} aria-hidden={i >= STACK.length}
                className="mx-6 whitespace-nowrap font-display text-2xl font-semibold tracking-tight text-muted/70 transition hover:text-ink sm:text-3xl">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative isolate overflow-hidden px-4 py-32 text-center sm:py-44">
        <Aurora />
        <Reveal className="relative">
          <h2 className="font-display text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-[1] tracking-[-0.045em]">
            Spend your time learning.
            <span className="text-gradient block pb-2">Not transcribing.</span>
          </h2>
          <Link to={cta} className="btn-primary btn-lg mt-12">
            Create your first notes <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted sm:flex-row sm:px-6">
          <Logo size={20} />
          <span>Built with FastAPI, PostgreSQL + pgvector, Whisper and React.</span>
        </div>
      </footer>
    </div>
  );
}
