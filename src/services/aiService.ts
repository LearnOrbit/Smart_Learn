/**
 * aiService.ts — typed wrappers for the /api/ai/* and /api/quizzes
 * endpoints added by the AI Assessment Generator feature.
 *
 * Every method follows the same convention as the rest of the app:
 *   const { data, error } = await aiService.generateQA(payload);
 *   if (error) throw error;            // or toast(error.message)
 *
 * The backend never returns 5xx stack traces — friendly `detail`
 * strings come through `error.message` and are safe to show in toasts.
 */
import { apiClient } from "@/integrations/api/client";

// ---- Types mirroring backend Pydantic schemas ----------------------------

export type DifficultyLevel = "easy" | "medium" | "hard";
export type BloomLevel =
  | "Remember"
  | "Understand"
  | "Apply"
  | "Analyze"
  | "Evaluate"
  | "Create";
export type SourceType = "topic" | "syllabus" | "document";

export interface GeneratedQA {
  question: string;
  answer: string;
  marks: number;
  difficulty: DifficultyLevel;
  bloom_level?: BloomLevel | null;
  course_outcome_code?: string | null;
  source_type?: SourceType;
}

export interface GeneratedMCQ {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  explanation?: string;
  marks: number;
  difficulty: DifficultyLevel;
  bloom_level?: BloomLevel | null;
  course_outcome_code?: string | null;
  source_type?: SourceType;
}

export interface AIQuestionRow {
  id: string;
  question_text: string;
  answer: string;
  marks: number;
  difficulty: DifficultyLevel;
  bloom_level?: string | null;
  course_outcome_code?: string | null;
  source_type: SourceType;
  source_ref?: string | null;
  subject_id?: string | null;
  co_id?: string | null;
  topic?: string | null;
  created_at?: string | null;
}

export interface AIMCQRow {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
  marks: number;
  difficulty: DifficultyLevel;
  bloom_level?: string | null;
  course_outcome_code?: string | null;
  subject_id?: string | null;
  co_id?: string | null;
  topic?: string | null;
  source?: string | null;
  created_at?: string | null;
}

export interface QuizRow {
  id: string;
  title: string;
  description: string;
  created_by: string;
  created_at?: string | null;
  updated_at?: string | null;
  questions: Array<{
    position: number;
    mcq: Omit<AIMCQRow, "explanation"> & { explanation: string };
  }>;
}

// ---- Request payloads -----------------------------------------------------

export interface GenerateQARequest {
  topic: string;
  co_id?: string;
  co_code?: string;
  co_description?: string;
  difficulty?: DifficultyLevel;
  marks?: number;
  count?: number;
  source_type?: SourceType;
  source_text?: string;
  subject_id?: string;
}

export interface GenerateMCQRequest {
  topic: string;
  co_id?: string;
  co_code?: string;
  co_description?: string;
  difficulty?: DifficultyLevel;
  marks?: number;
  count?: number;
  source_type?: SourceType;
  source_text?: string;
  subject_id?: string;
}

export interface RegenerateRequest {
  kind: "qa" | "mcq";
  previous: Record<string, unknown>;
  instruction: string;
}

export interface AIQuestionSavePayload {
  question_text: string;
  answer: string;
  marks: number;
  difficulty: DifficultyLevel;
  bloom_level?: string | null;
  course_outcome_code?: string | null;
  source_type: SourceType;
  source_ref?: string | null;
  subject_id?: string | null;
  co_id?: string | null;
  topic?: string | null;
}

export interface MCQSavePayload {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
  marks: number;
  difficulty: DifficultyLevel;
  bloom_level?: string | null;
  course_outcome_code?: string | null;
  subject_id?: string | null;
  co_id?: string | null;
  topic?: string | null;
  source?: string;
}

export interface CreateQuizRequest {
  title: string;
  description?: string;
  mcq_ids: string[];
}

export interface ExtractSourceResponse {
  text: string;
  pages?: number | null;
  file_name?: string | null;
}

// ---- Service --------------------------------------------------------------

export const aiService = {
  generateQA: (payload: GenerateQARequest) =>
    apiClient.post<{ questions: GeneratedQA[] }>("/ai/generate-questions", payload),

  generateMCQ: (payload: GenerateMCQRequest) =>
    apiClient.post<{ mcqs: GeneratedMCQ[] }>("/ai/generate-mcqs", payload),

  regenerate: (payload: RegenerateRequest) =>
    apiClient.post<{ question?: GeneratedQA; mcq?: GeneratedMCQ }>(
      "/ai/regenerate-question",
      payload
    ),

  extractSource: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.postFormData<ExtractSourceResponse>("/ai/extract-source", fd);
  },

  saveAIQuestion: (payload: AIQuestionSavePayload) =>
    apiClient.post<AIQuestionRow>("/ai/questions/save", payload),

  saveMCQ: (payload: MCQSavePayload) =>
    apiClient.post<AIMCQRow>("/ai/mcqs/save", payload),

  listAIQuestions: () =>
    apiClient.get<{ questions: AIQuestionRow[] }>("/ai/questions"),

  listMCQs: () => apiClient.get<{ mcqs: AIMCQRow[] }>("/ai/mcqs"),

  deleteAIQuestion: (id: string) => apiClient.delete(`/ai/questions/${id}`),

  deleteMCQ: (id: string) => apiClient.delete(`/ai/mcqs/${id}`),

  createQuiz: (payload: CreateQuizRequest) =>
    apiClient.post<QuizRow>("/quizzes", payload),

  listQuizzes: () => apiClient.get<{ quizzes: QuizRow[] }>("/quizzes"),

  getQuiz: (id: string) => apiClient.get<QuizRow>(`/quizzes/${id}`),

  // ---- student + teacher quick quiz (ephemeral, no DB write) ------------

  quickQuiz: (payload: {
    topic: string;
    count?: number;
    difficulty?: DifficultyLevel;
    co_code?: string;
    co_description?: string;
    subject_id?: string;
  }) => apiClient.post<{ mcqs: GeneratedMCQ[] }>("/ai/quick-quiz", payload),
};
