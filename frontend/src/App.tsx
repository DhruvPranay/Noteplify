import type { ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Aurora, usePointerFx } from "./components/fx";
import { PageLoader } from "./components/ui";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SpeechProvider } from "./context/SpeechContext";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { LectureDetail } from "./pages/LectureDetail";
import { Metrics } from "./pages/Metrics";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden text-center">
      <Aurora subtle />
      <div className="text-gradient relative font-display text-8xl font-semibold tracking-tighter sm:text-9xl">404</div>
      <p className="relative text-ink-2">This page doesn't exist.</p>
      <Link to="/" className="btn-primary relative">Go home</Link>
    </div>
  );
}

export default function App() {
  usePointerFx();
  return (
    <BrowserRouter>
      <AuthProvider>
        <SpeechProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="lectures/:id" element={<LectureDetail />} />
              <Route path="metrics" element={<Metrics />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SpeechProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
