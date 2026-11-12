import { ArrowLeft, ArrowRight, Check, Layers, RotateCcw, Shuffle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Flashcard } from "../lib/types";
import { ReadAloudButton } from "./ReadAloudButton";
import { EmptyState, ErrorNote, PageLoader } from "./ui";

export function FlashcardsView({ lectureId }: { lectureId: number }) {
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [review, setReview] = useState<Set<number>>(new Set());

  useEffect(() => {
    api
      .flashcards(lectureId)
      .then((c) => {
        setCards(c);
        setOrder(c.map((_, i) => i));
      })
      .catch((e: Error) => setError(e.message));
  }, [lectureId]);

  const card = cards && order.length ? cards[order[pos]] : null;

  const go = useCallback(
    (delta: number) => {
      if (!order.length) return;
      setFlipped(false);
      setPos((p) => (p + delta + order.length) % order.length);
    },
    [order.length],
  );

  const mark = (isKnown: boolean) => {
    if (!card) return;
    const add = (s: Set<number>) => new Set(s).add(card.id);
    const del = (s: Set<number>) => {
      const n = new Set(s);
      n.delete(card.id);
      return n;
    };
    setKnown(isKnown ? add : del);
    setReview(isKnown ? del : add);
    go(1);
  };

  const shuffle = () => {
    setOrder((o) => [...o].sort(() => Math.random() - 0.5));
    setPos(0);
    setFlipped(false);
  };

  const studyMissed = () => {
    if (!cards) return;
    const missed = cards.map((c, i) => (review.has(c.id) ? i : -1)).filter((i) => i >= 0);
    if (missed.length) {
      setOrder(missed);
      setPos(0);
      setFlipped(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const progress = useMemo(() => (cards?.length ? known.size / cards.length : 0), [known, cards]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!cards) return <PageLoader />;
  if (!cards.length || !card)
    return <div className="card"><EmptyState icon={<Layers className="h-6 w-6" />} title="No flashcards yet" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-2">
          Card <span className="font-semibold tabular-nums text-ink">{pos + 1}</span> of {order.length}
          <span className="mx-2 text-line">|</span>
          <span className="text-good">{known.size} known</span> · <span className="text-warn">{review.size} to review</span>
        </div>
        <div className="flex gap-2">
          {review.size > 0 && (
            <button className="btn-ghost py-2" onClick={studyMissed}>
              <RotateCcw className="h-4 w-4" /> Study missed
            </button>
          )}
          <button className="btn-ghost py-2" onClick={shuffle}>
            <Shuffle className="h-4 w-4" /> Shuffle
          </button>
        </div>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-good transition-all" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="flip-card">
        <div
          className={`flip-inner relative min-h-[280px] cursor-pointer ${flipped ? "flipped" : ""}`}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "Show question" : "Show answer"}
        >
          <div className="flip-face card absolute inset-0 flex flex-col p-6 sm:p-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">Question</span>
              <ReadAloudButton compact id={`card-q-${card.id}`} text={card.question} label="Read question" />
            </div>
            <p className="my-auto py-6 text-center text-xl font-semibold leading-snug sm:text-2xl">{card.question}</p>
            <p className="text-center text-xs text-muted">Click or press Space to flip</p>
          </div>
          <div className="flip-face flip-back card absolute inset-0 flex flex-col border-brand/30 bg-brand-soft p-6 sm:p-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">Answer</span>
              <ReadAloudButton compact id={`card-a-${card.id}`} text={card.answer} label="Read answer" />
            </div>
            <p className="my-auto py-6 text-center text-lg leading-relaxed sm:text-xl">{card.answer}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button className="btn-icon h-11 w-11 border border-line" onClick={() => go(-1)} aria-label="Previous card">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => mark(false)}>
            <X className="h-4 w-4 text-warn" /> Review again
          </button>
          <button className="btn-primary" onClick={() => mark(true)}>
            <Check className="h-4 w-4" /> I know it
          </button>
        </div>
        <button className="btn-icon h-11 w-11 border border-line" onClick={() => go(1)} aria-label="Next card">
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
