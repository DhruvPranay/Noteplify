import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Read-aloud with the Web Speech API (speechSynthesis).
 * One shared player for the whole app, so starting a new read-aloud stops the previous one.
 * Long text is split into sentence-sized utterances: Chrome silently stops long utterances.
 */
interface SpeechState {
  supported: boolean;
  activeId: string | null;
  paused: boolean;
  rate: number;
  setRate: (r: number) => void;
  speak: (id: string, text: string) => void;
  toggle: (id: string, text: string) => void;
  stop: () => void;
}

const SpeechContext = createContext<SpeechState | null>(null);
const RATE_KEY = "noteplify.speechRate";

function splitForSpeech(text: string, max = 220): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > max && buf) {
      parts.push(buf.trim());
      buf = "";
    }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) parts.push(s.slice(i, i + max));
    } else buf += s;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const lang = navigator.language || "en-US";
  return (
    voices.find((v) => v.lang === lang && /natural|neural|google|samantha|aria|jenny/i.test(v.name)) ??
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith("en"))
  );
}

export function SpeechProvider({ children }: { children: ReactNode }) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(() => {
    try {
      return Number(localStorage.getItem(RATE_KEY)) || 1;
    } catch {
      return 1;
    }
  });
  // Keep utterances referenced so they aren't garbage-collected mid-speech (Chrome bug).
  const queue = useRef<SpeechSynthesisUtterance[]>([]);
  const session = useRef(0);

  const stop = useCallback(() => {
    if (!supported) return;
    session.current += 1;
    queue.current = [];
    window.speechSynthesis.cancel();
    setActiveId(null);
    setPaused(false);
  }, [supported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const mySession = ++session.current;
      const voice = pickVoice();
      const parts = splitForSpeech(text);
      queue.current = parts.map((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.rate = rate;
        if (voice) u.voice = voice;
        if (i === parts.length - 1) {
          u.onend = () => {
            if (session.current === mySession) {
              setActiveId(null);
              setPaused(false);
            }
          };
        }
        u.onerror = (e) => {
          if (session.current === mySession && e.error !== "interrupted" && e.error !== "canceled") {
            setActiveId(null);
          }
        };
        return u;
      });
      queue.current.forEach((u) => window.speechSynthesis.speak(u));
      setActiveId(id);
      setPaused(false);
    },
    [supported, rate],
  );

  const toggle = useCallback(
    (id: string, text: string) => {
      if (!supported) return;
      if (activeId !== id) return speak(id, text);
      if (paused) {
        window.speechSynthesis.resume();
        setPaused(false);
      } else {
        window.speechSynthesis.pause();
        setPaused(true);
      }
    },
    [supported, activeId, paused, speak],
  );

  const setRate = useCallback((r: number) => {
    setRateState(r);
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.getVoices(); // warm the voice list
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  const value = useMemo(
    () => ({ supported, activeId, paused, rate, setRate, speak, toggle, stop }),
    [supported, activeId, paused, rate, setRate, speak, toggle, stop],
  );
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech(): SpeechState {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error("useSpeech must be used inside <SpeechProvider>");
  return ctx;
}
