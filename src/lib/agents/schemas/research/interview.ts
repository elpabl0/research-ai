import { z } from "zod";

export const StepReactionSchema = z.object({
  stepIndex: z
    .number()
    .int()
    .describe("Zero-based index of the step within the flow."),
  stepLabel: z
    .string()
    .nullable()
    .describe("Human label for this step; null if none."),
  reaction: z
    .string()
    .describe("What this user notices and feels on this step."),
  painPoints: z
    .array(z.string())
    .describe("Pain points for this step. Empty array if none."),
  delights: z
    .array(z.string())
    .describe("Delights for this step. Empty array if none."),
});

export const InterviewResponseSchema = z.object({
  /** Verbatim spoken response, in the persona's voice. */
  spoken: z
    .string()
    .describe("The persona's natural spoken answer, 2–6 sentences typically."),
  sentiment: z
    .enum([
      "positive",
      "neutral",
      "frustrated",
      "confused",
      "delighted",
      "skeptical",
    ])
    .describe("Dominant feeling expressed."),
  painPoints: z
    .array(z.string())
    .describe("Specific pain points raised. Empty array if none."),
  delights: z
    .array(z.string())
    .describe("Specific delights expressed. Empty array if none."),
  confusionPoints: z
    .array(z.string())
    .describe("Specific points of confusion. Empty array if none."),
  /** Populated when responding to a sequenced flow question; null otherwise. */
  stepReactions: z
    .array(StepReactionSchema)
    .nullable()
    .describe(
      "Per-step reactions for sequenced_flow questions; null for single-question turns.",
    ),
  /** Final overall reaction across the flow (sequenced_flow only). Null otherwise. */
  overallReaction: z
    .string()
    .nullable()
    .describe(
      "Overall reaction across the whole flow; null for single-question turns.",
    ),
});

export const FollowUpSchema = z.object({
  followUps: z
    .array(
      z.object({
        question: z.string().describe("Short, neutral follow-up question."),
        rationale: z.string().describe("Why probing here is worthwhile."),
      }),
    )
    .describe(
      "Zero to two follow-up questions. Empty array if none needed. The orchestrator caps at 2 anyway.",
    ),
});

export type InterviewResponse = z.infer<typeof InterviewResponseSchema>;
export type StepReaction = z.infer<typeof StepReactionSchema>;
export type FollowUpDecision = z.infer<typeof FollowUpSchema>;
