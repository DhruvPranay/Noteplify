/**
 * Motion primitives — dependency-free.
 *
 * Continuous scroll effects write CSS variables (--p, --mx, --rx …) straight onto DOM nodes, so
 * scrolling and pointer movement never re-render React. Only discrete changes (which story step is
 * active) go through state.
 */
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

/** True once the element has scrolled into view (or every time, with once=false). */
export function useInView<T extends Element = HTMLDivElement>(once = true, rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin, threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin]);
  return [ref, inView] as const;
}

type RevealProps = { children: ReactNode; className?: string; delay?: number } & Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "children"
>;

/** Fades, un-blurs and lifts its children the first time they enter the viewport. */
export function Reveal({ children, className = "", delay = 0, style, ...rest }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${inView ? "in-view" : ""} ${className}`}
      style={{ ...style, ...cssVars({ "--delay": `${delay}ms` }) }} {...rest}>
      {children}
    </div>
  );
}

/**
 * Tracks a 0→1 progress value for an element while the page scrolls and writes it to `--p` on
 * the element. `compute` maps the element's rect + viewport height to progress.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement>,
  compute: (rect: DOMRect, vh: number) => number,
  onChange?: (p: number) => void,
) {
  const computeRef = useRef(compute);
  const onChangeRef = useRef(onChange);
  computeRef.current = compute;
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = clamp01(computeRef.current(el.getBoundingClientRect(), window.innerHeight));
      el.style.setProperty("--p", p.toFixed(4));
      onChangeRef.current?.(p);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref]);
}

/**
 * One document-level pointer listener that powers every spotlight ([data-pointer] gets --mx/--my)
 * and tilt ([data-tilt="deg"] gets --rx/--ry). Mouse/trackpad only.
 */
export function usePointerFx() {
  useEffect(() => {
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    const reduced = prefersReducedMotion();
    let tilted: HTMLElement | null = null;

    const resetTilt = () => {
      if (!tilted) return;
      tilted.style.setProperty("--rx", "0deg");
      tilted.style.setProperty("--ry", "0deg");
      tilted = null;
    };

    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;

      let glow = target.closest<HTMLElement>("[data-pointer]");
      while (glow) {
        const r = glow.getBoundingClientRect();
        glow.style.setProperty("--mx", `${e.clientX - r.left}px`);
        glow.style.setProperty("--my", `${e.clientY - r.top}px`);
        glow = glow.parentElement?.closest<HTMLElement>("[data-pointer]") ?? null;
      }

      const tilt = reduced ? null : target.closest<HTMLElement>("[data-tilt]");
      if (tilt !== tilted) resetTilt();
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        const max = Number(tilt.dataset.tilt) || 6;
        tilt.style.setProperty("--rx", `${(-y * max).toFixed(2)}deg`);
        tilt.style.setProperty("--ry", `${(x * max).toFixed(2)}deg`);
        tilted = tilt;
      }
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", resetTilt);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", resetTilt);
    };
  }, []);
}

/**
 * Position for a sliding "active" indicator inside a segmented control. The active child is the
 * one with data-active="true" (or aria-current="page" for NavLinks).
 */
export function useIndicator(container: RefObject<HTMLElement>, dep: unknown): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const active = el.querySelector<HTMLElement>('[data-active="true"], [aria-current="page"]');
      if (!active) {
        setStyle({ opacity: 0 });
        return;
      }
      setStyle({
        opacity: 1,
        width: active.offsetWidth,
        height: active.offsetHeight,
        transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)`,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [container, dep]);
  return style;
}

/** Counts up to `value` with an ease-out curve when it scrolls into view. */
export function CountUp({ value, decimals = 0, suffix = "", duration = 1800 }: {
  value: number; decimals?: number; suffix?: string; duration?: number;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setShown(k === 1 ? value : value * (1 - Math.pow(2, -10 * k)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      <span className="sr-only">{value.toFixed(decimals)}{suffix}</span>
      <span aria-hidden>{shown.toFixed(decimals)}{suffix}</span>
    </span>
  );
}

/** Splits text into words that blur in one after another on load. */
export function WordReveal({ text, delay = 0, step = 80 }: { text: string; delay?: number; step?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <Fragment key={i}>
          <span className="word-in" style={{ animationDelay: `${delay + i * step}ms` }}>{w}</span>
          {" "}
        </Fragment>
      ))}
    </>
  );
}

/** Slow-drifting gradient light behind a section. */
export function Aurora({ className = "", subtle = false }: { className?: string; subtle?: boolean }) {
  return (
    <div aria-hidden className={`aurora ${subtle ? "aurora-subtle" : ""} ${className}`}>
      <span className="aurora-blob aurora-1" />
      <span className="aurora-blob aurora-2" />
      <span className="aurora-blob aurora-3" />
    </div>
  );
}

/** Decorative audio waveform. `played` (0–1) tints the bars left of the playhead. */
export function Waveform({ bars = 48, played = 0, animated = true, className = "" }: {
  bars?: number; played?: number; animated?: boolean; className?: string;
}) {
  const heights = useMemo(
    () => Array.from({ length: bars }, (_, i) => 0.18 + 0.82 * Math.abs(Math.sin(i * 1.73) * Math.cos(i * 0.41 + 1))),
    [bars],
  );
  return (
    <div aria-hidden className={`flex items-center gap-[3px] ${className}`}>
      {heights.map((h, i) => (
        <span key={i}
          className={`wave-bar ${animated ? "is-animated" : ""} ${i / bars < played ? "wave-played" : "bg-ink/20"}`}
          style={{ height: `${Math.round(h * 100)}%`, animationDelay: `${-((i * 0.137) % 1.3).toFixed(2)}s` }} />
      ))}
    </div>
  );
}
