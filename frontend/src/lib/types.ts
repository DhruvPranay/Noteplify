export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type LectureStatus = "queued" | "processing" | "completed" | "failed";

export interface LectureListItem {
  id: number;
  title: string;
  source_type: "upload" | "youtube";
  youtube_id: string | null;
  status: LectureStatus;
  stage: string | null;
  progress: number;
  error: string | null;
  duration_s: number | null;
  summary: string | null;
  created_at: string;
}

export interface Term {
  term: string;
  definition: string;
}

export interface NoteSection {
  title: string;
  start: number;
  end: number;
  summary: string;
  key_points: string[];
  terms: Term[];
}

export interface Metric {
  audio_duration_s: number;
  download_s: number;
  preprocess_s: number;
  transcribe_s: number;
  index_s: number;
  generate_s: number;
  total_s: number;
  rtf: number | null;
  minutes_per_audio_hour: number | null;
  transcribe_backend: string;
  asr_model: string;
  llm_model: string;
  embedding_model: string;
  num_audio_chunks: number;
  num_rag_chunks: number;
  wer: number | null;
  wer_details: WerResult | null;
}

export interface Lecture extends LectureListItem {
  source_url: string | null;
  original_filename: string | null;
  has_audio: boolean;
  language: string | null;
  notes_markdown: string | null;
  key_takeaways: string[] | null;
  sections: NoteSection[] | null;
  flashcard_count: number;
  metric: Metric | null;
  updated_at: string;
}

export interface Segment {
  idx: number;
  start: number;
  end: number;
  text: string;
}

export interface Flashcard {
  id: number;
  idx: number;
  question: string;
  answer: string;
}

export interface Source {
  chunk_id: number;
  lecture_id: number;
  lecture_title: string;
  start: number;
  end: number;
  text: string;
  score: number;
}

export interface QAEntry {
  id: number;
  question: string;
  answer: string;
  sources: Source[];
  created_at: string;
}

export interface WerResult {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  hits: number;
  reference_words: number;
  hypothesis_words: number;
}

export interface Run {
  lecture_id: number;
  title: string;
  audio_minutes: number;
  total_s: number;
  minutes_per_audio_hour: number | null;
  rtf: number | null;
  wer: number | null;
  transcribe_backend: string;
  asr_model: string;
  created_at: string;
}

export interface MetricsSummary {
  lectures_total: number;
  lectures_completed: number;
  lectures_failed: number;
  audio_hours: number;
  processing_hours: number;
  avg_minutes_per_audio_hour: number | null;
  avg_rtf: number | null;
  avg_wer: number | null;
  wer_samples: number;
  stage_share: Record<string, number>;
  runs: Run[];
}

export interface Health {
  status: string;
  app: string;
  mock_ai: boolean;
  transcribe_backend: string;
  asr_model: string;
  llm_model: string;
  embedding_model: string;
  hf_configured: boolean;
}
