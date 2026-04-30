import { z } from "zod";

export const PlanQuestionSchema = z.object({
  questionText: z
    .string()
    .describe("Open, neutral, non-leading interview question."),
  rationale: z
    .string()
    .describe("One-sentence reason this question is in the plan."),
  expectedTurnType: z
    .enum(["single", "sequenced_flow"])
    .describe(
      "Use 'sequenced_flow' if this question should walk the participant through a multi-step screen flow.",
    ),
  suggestedPersonaIds: z
    .array(z.string())
    .describe(
      "IDs of personas this question is most useful with, drawn from the provided persona list.",
    ),
});

export const ResearchPlanSchema = z.object({
  summary: z
    .string()
    .describe("2–4 sentences summarising the plan and what it will reveal."),
  suggestedSessionMode: z
    .enum(["one_on_one", "group"])
    .describe("Recommended mode for this study; the user can override."),
  questions: z
    .array(PlanQuestionSchema)
    .describe("3–12 questions. Quality over quantity."),
});

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
export type PlanQuestion = z.infer<typeof PlanQuestionSchema>;
