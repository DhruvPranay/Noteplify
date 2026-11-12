import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { LectureStatus } from "../lib/types";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand" />
        <path d="M9 8h10l4 4v12H9z" fill="white" />
        <path d="M12 15h8M12 18.5h8M12 22h5" className="stroke-brand" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight">
        Note<span className="text-brand">plify</span>
      </span>
    </span>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin text-brand`} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/5 px-3.5 py-2.5 text-sm text-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm text-ink-2">{children}</div>}
    </div>
  );
}

const STATUS: Record<LectureStatus, { label: string; cls: string; icon: ReactNode }> = {
  queued: { label: "Queued", cls: "bg-surface-2 text-ink-2", icon: <Clock className="h-3.5 w-3.5" /> },
  processing: {
    label: "Processing",
    cls: "bg-brand-soft text-brand",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  completed: { label: "Ready", cls: "bg-good/10 text-good", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  failed: { label: "Failed", cls: "bg-bad/10 text-bad", icon: <XCircle className="h-3.5 w-3.5" /> },
};

export function StatusBadge({ status }: { status: LectureStatus }) {
  const s = STATUS[status] ?? STATUS.queued;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar"
      aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.max(3, value * 100)}%` }} />
    </div>
  );
}
