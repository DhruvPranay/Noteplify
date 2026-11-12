import { ArrowRight, AudioLines, BookOpenCheck, Gauge, Layers, MessageSquareText, Volume2, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { icon: AudioLines, title: "Whisper transcription", body: "Silence-aware chunking and parallel Whisper large-v3 calls turn an hour of audio into a timestamped transcript in minutes." },
  { icon: BookOpenCheck, title: "Structured notes", body: "Sections with headings, summaries, key points and definitions — every section linked back to the moment it was said." },
  { icon: Layers, title: "Flashcards", body: "Auto-generated active-recall cards with flip, shuffle and a ‘review again’ pile for the ones you missed." },
  { icon: MessageSquareText, title: "Ask the lecture", body: "Hybrid semantic + keyword search (pgvector + Postgres full-text) grounds every answer in cited transcript excerpts." },
  { icon: Volume2, title: "Read aloud", body: "Listen to notes, answers and flashcards with the browser's Web Speech API — or ask questions with your voice." },
  { icon: Gauge, title: "Measured, not guessed", body: "Every run records per-stage timing and processing minutes per audio hour; score accuracy with word error rate." },
];

const STEPS = [
  ["Add a lecture", "Upload a recording or paste a YouTube link."],
  ["We transcribe", "Whisper converts speech to timestamped text."],
  ["AI organizes", "An LLM writes notes and flashcards; chunks are embedded for search."],
  ["You study", "Read, listen, quiz yourself and ask questions."],
];

export function Landing() {
  const { user } = useAuth();
  const cta = user ? "/app" : "/register";

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to="/app" className="btn-primary">Open app</Link>
          ) : (
            <>
              <Link to="/login" className="btn px-3 text-ink-2 hover:text-ink">Sign in</Link>
              <Link to="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] max-w-4xl rounded-full bg-brand/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <span className="chip mb-6 border border-line bg-surface">
            <Youtube className="h-3.5 w-3.5 text-bad" /> Works with uploads and YouTube links
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Turn any lecture into
            <span className="block bg-gradient-to-r from-brand to-fuchsia-500 bg-clip-text text-transparent">notes you'll actually use.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-2">
            Noteplify transcribes your lecture with Whisper, then writes structured notes, flashcards and a
            searchable Q&A — all linked to the exact second in the recording.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to={cta} className="btn-primary px-6 py-3 text-base">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how" className="btn-ghost px-6 py-3 text-base">How it works</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">How it works</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="relative">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">{i + 1}</div>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-line bg-bg p-5 font-mono text-xs leading-relaxed text-ink-2 sm:text-sm">
            <span className="text-brand">audio</span> → ffmpeg (16 kHz mono, silence-aware ≤30 s chunks) → Whisper large-v3 ×N in parallel
            <br />→ transcript → 160-word overlapping chunks → MiniLM embeddings → <span className="text-brand">PostgreSQL + pgvector</span>
            <br />→ map-reduce LLM notes &amp; flashcards → hybrid retrieval (vector + full-text, RRF) for Q&amp;A
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Spend your time learning, not transcribing.</h2>
        <Link to={cta} className="btn-primary mt-8 px-6 py-3 text-base">
          Create your first notes <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        Noteplify · Built with FastAPI, PostgreSQL + pgvector, Hugging Face and React
      </footer>
    </div>
  );
}
