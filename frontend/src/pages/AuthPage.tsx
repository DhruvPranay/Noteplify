import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Aurora } from "../components/fx";
import { ErrorNote, Logo } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogin = mode === "login";
  const next = (location.state as { from?: string } | null)?.from ?? "/app";

  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <Aurora />
      <div className="grid-overlay" aria-hidden />
      <Link to="/" className="rise-in relative mb-8"><Logo size={36} /></Link>
      <form onSubmit={submit} data-pointer className="card spotlight rise-in relative w-full max-w-sm p-6 shadow-device sm:p-8" style={{ animationDelay: "120ms" }}>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-2">
          {isLogin ? "Sign in to your lecture library." : "Start turning lectures into study notes."}
        </p>
        <div className="space-y-4">
          {!isLogin && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={isLogin ? 1 : 8} autoComplete={isLogin ? "current-password" : "new-password"} />
            {!isLogin && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-ink-2">
          {isLogin ? "New to Noteplify? " : "Already have an account? "}
          <Link to={isLogin ? "/register" : "/login"} state={location.state} className="font-semibold text-brand hover:underline">
            {isLogin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </form>
    </div>
  );
}
