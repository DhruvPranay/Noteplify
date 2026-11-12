import { Headphones } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Lecture } from "../lib/types";

export interface PlayerHandle {
  seek: (seconds: number) => void;
}

/** Audio player for uploads, YouTube embed for links. Exposes `seek()` for timestamp chips. */
export const Player = forwardRef<PlayerHandle, { lecture: Lecture }>(function Player({ lecture }, ref) {
  const wrapper = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [ytStart, setYtStart] = useState<{ t: number; key: number } | null>(null);

  useEffect(() => {
    if (!lecture.has_audio) return;
    let alive = true;
    api
      .mediaToken(lecture.id)
      .then((r) => alive && setSrc(api.audioUrl(lecture.id, r.token)))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [lecture.id, lecture.has_audio]);

  useImperativeHandle(ref, () => ({
    seek(seconds: number) {
      const t = Math.max(0, seconds);
      if (audio.current) {
        audio.current.currentTime = t;
        void audio.current.play().catch(() => undefined);
      } else if (lecture.youtube_id) {
        setYtStart({ t, key: Date.now() });
      }
      const rect = wrapper.current?.getBoundingClientRect();
      if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
        wrapper.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
  }));

  if (lecture.youtube_id) {
    const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
    if (ytStart) {
      params.set("start", String(Math.floor(ytStart.t)));
      params.set("autoplay", "1");
    }
    return (
      <div ref={wrapper} className="overflow-hidden rounded-2xl border border-line bg-black shadow-card">
        <iframe
          key={ytStart?.key ?? 0}
          className="aspect-video w-full"
          src={`https://www.youtube-nocookie.com/embed/${lecture.youtube_id}?${params}`}
          title={lecture.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div ref={wrapper} className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Headphones className="h-4 w-4 text-brand" />
        Recording
      </div>
      {lecture.has_audio ? (
        src ? <audio ref={audio} controls preload="metadata" src={src} className="w-full" /> : <div className="h-[54px] animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <p className="text-sm text-muted">The original recording isn't stored on the server anymore.</p>
      )}
    </div>
  );
});
