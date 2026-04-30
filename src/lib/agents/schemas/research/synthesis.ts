import { z } from "zod";

export const TurnSynthesisSchema = z.object({
  summary: z.string().describe("1–2 sentence summary of what was learned."),
  keyPoints: z
    .array(z.object({ point: z.string(), personaId: z.string() }))
    .describe("Up to 5 key points, each tied to a persona id."),
  surprises: z
    .array(z.string())
    .describe("Up to 3 surprises or contradictions. Empty array if none."),
  openQuestions: z
    .array(z.string())
    .describe("Up to 3 open questions raised. Empty array if none."),
});

export const SessionSynthesisSchema = z.object({
  narrative: z
    .string()
    .describe(
      "2–4 sentence narrative of how this participant experienced the topic.",
    ),
  standoutQuotes: z
    .array(
      z.object({
        quote: z.string(),
        turnOrderIndex: z
          .number()
          .int()
          .nullable()
          .describe(
            "Index of the turn this quote came from; null if unknown.",
          ),
      }),
    )
    .describe("Up to 6 standout quotes verbatim. Empty array if none."),
  topFrustrations: z
    .array(z.string())
    .describe("Top frustrations. Empty array if none."),
  topDelights: z
    .array(z.string())
    .describe("Top delights. Empty array if none."),
  recurringThemes: z
    .array(z.string())
    .describe("Recurring themes inside this session. Empty array if none."),
});

export const ReportFindingSchema = z.object({
  finding: z.string(),
  evidenceStrength: z.enum(["strong", "moderate", "suggestive"]),
  contributingPersonaIds: z
    .array(z.string())
    .describe("Persona ids that contributed evidence. Empty array if none."),
});

export const ReportThemeSchema = z.object({
  name: z.string(),
  description: z.string(),
  supportingQuotes: z
    .array(
      z.object({
        quote: z.string(),
        personaId: z.string(),
      }),
    )
    .describe("1–4 supporting quotes."),
});

export const PerPersonaFindingSchema = z.object({
  personaId: z.string(),
  personaName: z.string(),
  distinctive: z
    .string()
    .describe("What was distinctive about this persona's experience."),
});

export const ReportRecommendationSchema = z.object({
  action: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  relatedFindingIndex: z
    .number()
    .int()
    .nullable()
    .describe(
      "Index into keyFindings[] this recommendation addresses; null if not tied to a single finding.",
    ),
});

export const ReportSchema = z.object({
  executiveSummary: z.string().describe("3–5 sentence headline summary."),
  keyFindings: z
    .array(ReportFindingSchema)
    .describe("3–8 key findings."),
  themes: z
    .array(ReportThemeSchema)
    .describe("Cross-session themes. Empty array if none."),
  perPersonaFindings: z
    .array(PerPersonaFindingSchema)
    .describe("Per-persona findings. Empty array if none."),
  recommendations: z
    .array(ReportRecommendationSchema)
    .describe("Recommendations. Empty array if none."),
  openQuestions: z
    .array(z.string())
    .describe("Questions this study didn't answer. Empty array if none."),
  sampleCaveat: z
    .string()
    .describe(
      "One sentence noting these are simulated personas, not real users.",
    ),
});

export type TurnSynthesis = z.infer<typeof TurnSynthesisSchema>;
export type SessionSynthesis = z.infer<typeof SessionSynthesisSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ReportFinding = z.infer<typeof ReportFindingSchema>;
export type ReportTheme = z.infer<typeof ReportThemeSchema>;
export type PerPersonaFinding = z.infer<typeof PerPersonaFindingSchema>;
export type ReportRecommendation = z.infer<typeof ReportRecommendationSchema>;
