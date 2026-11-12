import { ArrowUpRight, Clock3, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDuration, formatRelative, STAGE_LABELS } from "../lib/format";
import type { LectureListItem } from "../lib/types";
import { Waveform } from "./fx";
import { ProgressBar, StatusBadge } from "./ui";

export function LectureCard({ lecture }: { lecture: LectureListItem }) {
  const busy = lecture.status === "queued" || lecture.status === "processing";
  return (
    <Link to={`/app/lectures/${lecture.id}`} data-pointer data-tilt="5"
      className="card spotlight group flex h-full flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30">
      <div className="relative aspect-[16/8] overflow-hidden">
        {lecture.youtube_id ? (
          <img src={`https://i.ytimg.com/vi/${lecture.youtube_id}/mqdefault.jpg`} alt=""
            className="h-full w-full object-cover transition duration-700 ease-out-expo group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="relative flex h-full items-center bg-gradient-to-br from-brand/25 via-brand-soft to-fuchsia-500/20 px-6">
            <Waveform bars={36} played={busy ? lecture.progress : lecture.status === "completed" ? 1 : 0} animated={busy}
              className="h-12 w-full opacity-80 transition duration-700 ease-out-expo group-hover:scale-y-110" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute left-3 top-3"><StatusBadge status={lecture.status} /></div>
        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
          {lecture.source_type === "youtube" ? <Youtube className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
          {formatDuration(lecture.duration_s)}
        </div>
        <span className="absolute right-3 top-3 grid h-8 w-8 translate-y-1 place-items-center rounded-full bg-surface/90 text-ink opacity-0 backdrop-blur transition duration-500 ease-out-expo group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug tracking-tight">{lecture.title}</h3>
        {busy ? (
          <div className="mt-3 space-y-1.5">
            <div className="text-xs font-medium text-ink-2">{STAGE_LABELS[lecture.stage ?? "queued"] ?? lecture.stage}</div>
            <ProgressBar value={lecture.progress} />
          </div>
        ) : lecture.status === "failed" ? (
          <p className="mt-2 line-clamp-2 text-sm text-bad">{lecture.error}</p>
        ) : (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">{lecture.summary}</p>
        )}
        <div className="mt-auto pt-4 text-xs text-muted">{formatRelative(lecture.created_at)}</div>
      </div>
    </Link>
  );
}
