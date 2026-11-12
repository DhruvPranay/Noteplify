import { Clock3, FileAudio, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDuration, formatRelative, STAGE_LABELS } from "../lib/format";
import type { LectureListItem } from "../lib/types";
import { ProgressBar, StatusBadge } from "./ui";

export function LectureCard({ lecture }: { lecture: LectureListItem }) {
  const busy = lecture.status === "queued" || lecture.status === "processing";
  return (
    <Link to={`/app/lectures/${lecture.id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand/40 animate-fade-in">
      <div className="relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-brand/15 via-brand-soft to-surface-2">
        {lecture.youtube_id ? (
          <img src={`https://i.ytimg.com/vi/${lecture.youtube_id}/mqdefault.jpg`} alt=""
            className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileAudio className="h-10 w-10 text-brand/60" />
          </div>
        )}
        <div className="absolute left-3 top-3"><StatusBadge status={lecture.status} /></div>
        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
          {lecture.source_type === "youtube" ? <Youtube className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
          {formatDuration(lecture.duration_s)}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-brand">{lecture.title}</h3>
        {busy ? (
          <div className="mt-3 space-y-1.5">
            <div className="text-xs font-medium text-ink-2">{STAGE_LABELS[lecture.stage ?? "queued"] ?? lecture.stage}</div>
            <ProgressBar value={lecture.progress} />
          </div>
        ) : lecture.status === "failed" ? (
          <p className="mt-2 line-clamp-2 text-sm text-bad">{lecture.error}</p>
        ) : (
          <p className="mt-2 line-clamp-2 text-sm text-ink-2">{lecture.summary}</p>
        )}
        <div className="mt-auto pt-3 text-xs text-muted">{formatRelative(lecture.created_at)}</div>
      </div>
    </Link>
  );
}
