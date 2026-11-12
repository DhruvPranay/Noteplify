import { BarChart3, FlaskConical, LayoutGrid, LogOut } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHealth } from "../hooks/useHealth";
import { Logo } from "./ui";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  }`;

export function AppLayout() {
  const { user, logout } = useAuth();
  const health = useHealth();

  return (
    <div className="min-h-screen">
      {health?.mock_ai && (
        <div className="flex items-center justify-center gap-2 bg-warn/15 px-4 py-1.5 text-center text-xs font-medium text-ink">
          <FlaskConical className="h-3.5 w-3.5" />
          Demo mode — transcripts and notes are simulated. Set HF_TOKEN and MOCK_AI=false for real AI.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to="/app" className="mr-2 sm:mr-6">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/app" end className={navCls}>
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Lectures</span>
            </NavLink>
            <NavLink to="/app/metrics" className={navCls}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Metrics</span>
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight">{user?.name}</div>
              <div className="text-xs text-muted">{user?.email}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink" aria-hidden>
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <button className="btn-icon" onClick={logout} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
