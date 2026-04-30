import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── Settings (key/value store: API keys, prompt overrides, persona overrides) ──

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ── Studies ──────────────────────────────────────────────

export const studies = sqliteTable("studies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  problemStatement: text("problem_statement").notNull(),
  researchGoals: text("research_goals"),
  status: text("status", {
    enum: ["draft", "planning", "plan_ready", "running", "completed", "interrupted"],
  })
    .notNull()
    .default("draft"),
  sessionMode: text("session_mode", { enum: ["one_on_one", "group"] })
    .notNull()
    .default("one_on_one"),
  /** JSON: { selectedPersonaIds: string[], notes?: string, … } */
  config: text("config"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Personas (custom user-type personas; presets live in src/config) ──

export const personas = sqliteTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull().default("👤"),
  color: text("color").notNull().default("#6366F1"),
  /** JSON: { age, gender, location, occupation, … } */
  demographics: text("demographics"),
  /** JSON: string[] */
  goals: text("goals"),
  /** JSON: string[] */
  painPoints: text("pain_points"),
  techComfort: text("tech_comfort", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  /** JSON: string[] */
  behaviouralTraits: text("behavioural_traits"),
  communicationStyle: text("communication_style"),
  systemPromptFragment: text("system_prompt_fragment").notNull(),
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Study artifacts (study-level uploads: docs + images) ──

export const studyArtifacts = sqliteTable("study_artifacts", {
  id: text("id").primaryKey(),
  studyId: text("study_id")
    .notNull()
    .references(() => studies.id),
  kind: text("kind", { enum: ["document", "image"] }).notNull(),
  filename: text("filename").notNull(),
  /** Relative path under data/uploads/{studyId}/ */
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  /** Extracted text for documents (PDF/DOCX/etc.); null for images */
  extractedText: text("extracted_text"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Research plans ───────────────────────────────────────

export const researchPlans = sqliteTable("research_plans", {
  id: text("id").primaryKey(),
  studyId: text("study_id")
    .notNull()
    .references(() => studies.id),
  status: text("status", { enum: ["draft", "edited", "locked"] })
    .notNull()
    .default("draft"),
  notes: text("notes"),
  generatedAt: integer("generated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const planQuestions = sqliteTable("plan_questions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => researchPlans.id),
  orderIndex: integer("order_index").notNull(),
  questionText: text("question_text").notNull(),
  /** JSON: string[] of persona ids assigned to this question */
  assignedPersonaIds: text("assigned_persona_ids").notNull(),
  expectedTurnType: text("expected_turn_type", {
    enum: ["single", "sequenced_flow"],
  })
    .notNull()
    .default("single"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const questionAttachments = sqliteTable("question_attachments", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => planQuestions.id),
  /** Step number for sequenced flows; 0 for single attachments */
  orderIndex: integer("order_index").notNull().default(0),
  filename: text("filename").notNull(),
  /** Relative path under data/uploads/{studyId}/ */
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  /** Optional human label for the step ("Login screen", "Empty state", …) */
  label: text("label"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Sessions, turns, responses, follow-ups ───────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  studyId: text("study_id")
    .notNull()
    .references(() => studies.id),
  /** For one_on_one: the persona for this session. For group: empty (use personaSnapshot for the group cohort). */
  personaId: text("persona_id"),
  /** JSON snapshot of persona(s) at session start, so later persona edits don't change history. */
  personaSnapshot: text("persona_snapshot").notNull(),
  mode: text("mode", { enum: ["one_on_one", "group"] }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "interrupted"],
  })
    .notNull()
    .default("pending"),
  /** Per-session synthesis text */
  summary: text("summary"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const turns = sqliteTable("turns", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  planQuestionId: text("plan_question_id")
    .notNull()
    .references(() => planQuestions.id),
  orderIndex: integer("order_index").notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "interrupted"],
  })
    .notNull()
    .default("pending"),
  synthesisText: text("synthesis_text"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id),
  personaId: text("persona_id").notNull(),
  personaName: text("persona_name").notNull(),
  kind: text("kind", { enum: ["initial", "follow_up"] })
    .notNull()
    .default("initial"),
  /** For follow-up answers: the response that triggered the follow-up */
  parentResponseId: text("parent_response_id"),
  questionAsked: text("question_asked").notNull(),
  responseText: text("response_text").notNull(),
  /** JSON: full structured InterviewResponse incl. stepReactions[] for sequenced flows */
  structuredOutput: text("structured_output"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const followUps = sqliteTable("follow_ups", {
  id: text("id").primaryKey(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id),
  parentResponseId: text("parent_response_id")
    .notNull()
    .references(() => responses.id),
  orderIndex: integer("order_index").notNull(),
  questionText: text("question_text").notNull(),
  rationale: text("rationale"),
  /** Depth in the follow-up chain (1 or 2; cap at MAX_FOLLOWUP_DEPTH) */
  depth: integer("depth").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Synthesis (turn / session / report layers) ───────────

export const synthesis = sqliteTable("synthesis", {
  id: text("id").primaryKey(),
  studyId: text("study_id").references(() => studies.id),
  sessionId: text("session_id").references(() => sessions.id),
  turnId: text("turn_id").references(() => turns.id),
  kind: text("kind", { enum: ["turn", "session", "report"] }).notNull(),
  text: text("text").notNull(),
  /** JSON: structured output (TurnSynthesis | SessionSynthesis | Report) */
  structuredOutput: text("structured_output"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Final report sections (broken out for editability) ───

export const reportSections = sqliteTable("report_sections", {
  id: text("id").primaryKey(),
  studyId: text("study_id")
    .notNull()
    .references(() => studies.id),
  sectionKey: text("section_key", {
    enum: [
      "executive_summary",
      "key_findings",
      "themes",
      "per_persona",
      "recommendations",
      "open_questions",
    ],
  }).notNull(),
  orderIndex: integer("order_index").notNull(),
  /** Markdown content for display */
  content: text("content").notNull(),
  /** JSON: structured shape for this section (themes[], findings[], etc.) */
  structuredOutput: text("structured_output"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
