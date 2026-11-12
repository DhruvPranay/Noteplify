import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { LectureStatus } from "../lib/types";

export function Logo({ size = 32 }: { size?: number }) {
  const gid = `logo-${useId().replace(/:/g, "")}`;
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4f46e5" />
            <stop offset="0.55" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#c026d3" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
        <path d="M9 8h10l4 4v12H9z" fill="white" />
        <path d="M12 15h8M12 18.5h8M12 22h5" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">
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
    <div role="alert" className="flex items-start gap-2 rounded-2xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="relative mb-5">
        <span className="pulse-ring absolute inset-0 rounded-2xl bg-brand/25" aria-hidden />
        <div className="bg-aurora relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow">{icon}</div>
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-sm text-ink-2">{children}</div>}
    </div>
  );
}

const STATUS: Record<LectureStatus, { label: string; cls: string; icon: ReactNode }> = {
  queued: { label: "Queued", cls: "bg-surface/90 text-ink-2", icon: <Clock className="h-3.5 w-3.5" /> },
  processing: {
    label: "Processing",
    cls: "bg-brand-soft/95 text-brand",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  completed: { label: "Ready", cls: "bg-surface/90 text-good", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  failed: { label: "Failed", cls: "bg-surface/90 text-bad", icon: <XCircle className="h-3.5 w-3.5" /> },
};

export function StatusBadge({ status }: { status: LectureStatus }) {
  const s = STATUS[status] ?? STATUS.queued;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-line/60 backdrop-blur ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar"
      aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bg-aurora shimmer h-full rounded-full shadow-glow transition-[width] duration-700 ease-out-expo"
        style={{ width: `${Math.max(3, value * 100)}%` }} />
    </div>
  );
}
