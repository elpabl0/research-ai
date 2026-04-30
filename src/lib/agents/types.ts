import type { PersonaDef } from "@/config/personas";
import type { SessionMode } from "@/config/research";

// ── Study + plan + run context ───────────────────────────

export interface StudyContext {
  studyId: string;
  title: string;
  problemStatement: string;
  researchGoals?: string;
  /** Concatenated extracted text from supporting documents (truncated upstream). */
  supportingData: string;
  /** Display-friendly summary of attached artifacts (filenames, labels). */
  artifactSummary: string;
  sessionMode: SessionMode;
}

/**
 * One image attachment fed into a multimodal persona call. `orderIndex` is the
 * step number for sequenced flows (0 for single attachments).
 */
export interface InterviewAttachment {
  id: string;
  orderIndex: number;
  filename: string;
  /** Resolved file bytes ready to ship to the model. */
  data: Buffer | Uint8Array;
  mimeType: string;
  label?: string;
}

export interface PlanQuestionContext {
  id: string;
  orderIndex: number;
  questionText: string;
  expectedTurnType: "single" | "sequenced_flow";
  attachments: InterviewAttachment[];
}

export interface SessionContext {
  sessionId: string;
  mode: SessionMode;
  /** For 1-on-1: a single persona. For group: the cohort. */
  personas: PersonaDef[];
  /** Compact running summary fed back into prompts so personas remember earlier turns in the same session. */
  runningSummary: string;
}

export interface TurnContext {
  turnId: string;
  question: PlanQuestionContext;
  /** Per-turn synthesis from earlier turns in the same session. */
  priorTurnSyntheses: Array<{ orderIndex: number; questionText: string; summary: string }>;
}

// ── SSE event types ──────────────────────────────────────

export type StreamEventType =
  | "plan_generated"
  | "plan_updated"
  | "study_start"
  | "session_start"
  | "session_complete"
  | "turn_start"
  | "question_asked"
  | "response_streaming"
  | "response_received"
  | "follow_up_asked"
  | "turn_synthesis"
  | "session_synthesis"
  | "report_section"
  | "report_generated"
  | "study_complete"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
}
