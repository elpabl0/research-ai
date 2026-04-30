export const MAX_FOLLOWUP_DEPTH = 2;
export const MAX_FOLLOWUPS_PER_TURN = 2;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
] as const;

export const SESSION_MODES = ["one_on_one", "group"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SUGGESTED_QUESTION_COUNT_MIN = 5;
export const SUGGESTED_QUESTION_COUNT_MAX = 10;
