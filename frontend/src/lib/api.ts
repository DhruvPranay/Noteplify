import type {
  Flashcard, Health, Lecture, LectureListItem, MetricsSummary, QAEntry, Segment, Source, TokenResponse, User, WerResult,
} from "./types";

/** Empty = same origin (Vite proxy in dev, or the API serving the built app). */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "noteplify.token";

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "");
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the Noteplify server. Is the backend running?");
  }
  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, errorMessage(body, `Request failed (${res.status})`));
  }
  return body as T;
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  health: () => request<Health>("/health"),

  register: (name: string, email: string, password: string) =>
    request<TokenResponse>("/auth/register", { method: "POST", body: json({ name, email, password }) }),
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: json({ email, password }) }),
  me: () => request<User>("/auth/me"),

  lectures: () => request<LectureListItem[]>("/lectures"),
  lecture: (id: number) => request<Lecture>(`/lectures/${id}`),
  createFromYouTube: (url: string, title?: string) =>
    request<Lecture>("/lectures/youtube", { method: "POST", body: json({ url, title: title || null }) }),
  rename: (id: number, title: string) =>
    request<Lecture>(`/lectures/${id}`, { method: "PATCH", body: json({ title }) }),
  remove: (id: number) => request<void>(`/lectures/${id}`, { method: "DELETE" }),
  retry: (id: number) => request<Lecture>(`/lectures/${id}/retry`, { method: "POST" }),
  transcript: (id: number) => request<Segment[]>(`/lectures/${id}/transcript`),
  flashcards: (id: number) => request<Flashcard[]>(`/lectures/${id}/flashcards`),
  mediaToken: (id: number) => request<{ token: string; expires_in: number }>(`/lectures/${id}/media-token`),
  audioUrl: (id: number, token: string) => `${API_BASE}/api/lectures/${id}/audio?token=${encodeURIComponent(token)}`,

  ask: (id: number, question: string) =>
    request<QAEntry>(`/lectures/${id}/ask`, { method: "POST", body: json({ question }) }),
  qaHistory: (id: number) => request<QAEntry[]>(`/lectures/${id}/qa`),
  clearQa: (id: number) => request<void>(`/lectures/${id}/qa`, { method: "DELETE" }),
  search: (q: string, lectureId?: number) =>
    request<{ query: string; hits: Source[] }>(
      `/search?q=${encodeURIComponent(q)}${lectureId ? `&lecture_id=${lectureId}` : ""}`,
    ),

  wer: (id: number, reference: string) =>
    request<WerResult>(`/lectures/${id}/wer`, { method: "POST", body: json({ reference }) }),
  metrics: () => request<MetricsSummary>("/metrics/summary"),

  async exportMarkdown(id: number): Promise<{ blob: Blob; filename: string }> {
    const token = tokenStore.get();
    const res = await fetch(`${API_BASE}/api/lectures/${id}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "Export failed");
    const match = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
    return { blob: await res.blob(), filename: match?.[1] ?? "notes.md" };
  },

  /** Upload with progress reporting (fetch can't report upload progress). */
  upload(file: File, title: string, onProgress: (fraction: number) => void): Promise<Lecture> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/lectures/upload`);
      const token = tokenStore.get();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onerror = () => reject(new ApiError(0, "Upload failed — check your connection."));
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* not JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as Lecture);
        else reject(new ApiError(xhr.status, errorMessage(body, `Upload failed (${xhr.status})`)));
      };
      const form = new FormData();
      form.append("file", file);
      if (title.trim()) form.append("title", title.trim());
      xhr.send(form);
    });
  },
};
