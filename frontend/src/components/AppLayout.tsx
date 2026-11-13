import { BarChart3, FlaskConical, LayoutGrid, LogOut } from "lucide-react";
import { useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHealth } from "../hooks/useHealth";
import { Aurora, useIndicator } from "./fx";
import { Logo } from "./ui";

export function AppLayout() {
  const { user, logout } = useAuth();
  const health = useHealth();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const onMetrics = location.pathname.startsWith("/app/metrics");
  const indicator = useIndicator(navRef, onMetrics);

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <Aurora subtle />
      </div>
      {health?.mock_ai && (
        <div className="flex items-center justify-center gap-2 bg-warn/15 px-4 py-1.5 text-center text-xs font-medium text-ink">
          <FlaskConical className="h-3.5 w-3.5" />
          Demo mode — transcripts and notes are simulated. Set HF_TOKEN and MOCK_AI=false for real AI.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/70 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="mr-1 shrink-0 sm:mr-4" aria-label="Noteplify home page">
            <Logo size={28} />
          </Link>
          <nav ref={navRef} className="seg">
            <span className="seg-indicator" style={indicator} aria-hidden />
            <Link to="/app" className="seg-item" data-active={!onMetrics} aria-current={!onMetrics ? "page" : undefined}>
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Lectures</span>
            </Link>
            <Link to="/app/metrics" className="seg-item" data-active={onMetrics} aria-current={onMetrics ? "page" : undefined}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Metrics</span>
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight">{user?.name}</div>
              <div className="text-xs text-muted">{user?.email}</div>
            </div>
            <div className="bg-aurora flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white shadow-glow ring-2 ring-surface" aria-hidden>
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <button className="btn-icon" onClick={logout} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main key={location.pathname} className="mx-auto max-w-6xl animate-page-in px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
