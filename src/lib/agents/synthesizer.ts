import { generateStructuredOutput } from "@/lib/ai/provider";
import { loadPrompt } from "./prompt-loader";
import {
  TurnSynthesisSchema,
  SessionSynthesisSchema,
  ReportSchema,
  type TurnSynthesis,
  type SessionSynthesis,
  type Report,
} from "./schemas/research/synthesis";
import type { PersonaDef } from "@/config/personas";
import type { InterviewResponse } from "./schemas/research/interview";

interface TurnInputResponse {
  personaId: string;
  personaName: string;
  kind: "initial" | "follow_up";
  questionAsked: string;
  response: InterviewResponse;
}

export async function synthesizeTurn(input: {
  questionText: string;
  responses: TurnInputResponse[];
}): Promise<TurnSynthesis> {
  const responsesBlock = input.responses
    .map((r, i) => {
      const stepBlock = r.response.stepReactions?.length
        ? r.response.stepReactions
            .map(
              (s, idx) =>
                `    • Step ${idx + 1}${s.stepLabel ? ` (${s.stepLabel})` : ""}: ${s.reaction}`,
            )
            .join("\n")
        : "";
      return [
        `${i + 1}. ${r.personaName} [${r.kind}] — Q: ${r.questionAsked}`,
        `   "${r.response.spoken}" (sentiment: ${r.response.sentiment})`,
        r.response.painPoints.length ? `   Pain: ${r.response.painPoints.join("; ")}` : "",
        r.response.delights.length ? `   Delight: ${r.response.delights.join("; ")}` : "",
        r.response.confusionPoints.length
          ? `   Confusion: ${r.response.confusionPoints.join("; ")}`
          : "",
        stepBlock,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const system = await loadPrompt("synthesizer_turn_system", {
    questionText: input.questionText,
    responsesBlock,
  });

  const prompt = `Synthesise this turn.

## Question
${input.questionText}

## Responses
${responsesBlock}

Output structured JSON only.`;

  const result = await generateStructuredOutput({
    system,
    prompt,
    schema: TurnSynthesisSchema,
  });

  return result.object;
}

export async function synthesizeSession(input: {
  persona: PersonaDef;
  turns: Array<{
    orderIndex: number;
    questionText: string;
    turnSynthesis: TurnSynthesis;
    responses: TurnInputResponse[];
  }>;
}): Promise<SessionSynthesis> {
  const turnsBlock = input.turns
    .map((t) => {
      const responses = t.responses
        .map(
          (r) =>
            `   - ${r.personaName} [${r.kind}]: "${r.response.spoken}"`,
        )
        .join("\n");
      return [
        `### Turn ${t.orderIndex + 1}: ${t.questionText}`,
        `Synthesis: ${t.turnSynthesis.summary}`,
        responses,
      ].join("\n");
    })
    .join("\n\n");

  const personaSummary = `${input.persona.name} (${input.persona.id}) — tech ${input.persona.techComfort}. ${input.persona.description}`;

  const system = await loadPrompt("synthesizer_session_system", {
    personaSummary,
    turnsBlock,
  });

  const prompt = `Synthesise this entire session.

## Participant
${personaSummary}

## Turns
${turnsBlock}

Output structured JSON only.`;

  const result = await generateStructuredOutput({
    system,
    prompt,
    schema: SessionSynthesisSchema,
  });

  return result.object;
}

export async function generateReport(input: {
  studyTitle: string;
  problemStatement: string;
  researchGoals?: string;
  sessions: Array<{
    persona: PersonaDef;
    sessionSynthesis: SessionSynthesis;
  }>;
}): Promise<Report> {
  const sessionsBlock = input.sessions
    .map((s) => {
      const ss = s.sessionSynthesis;
      const quotes = ss.standoutQuotes
        .map((q) => `   - "${q.quote}"`)
        .join("\n");
      return [
        `### ${s.persona.name} (${s.persona.id})`,
        ss.narrative,
        `Top frustrations: ${ss.topFrustrations.join("; ") || "(none)"}`,
        `Top delights: ${ss.topDelights.join("; ") || "(none)"}`,
        `Themes: ${ss.recurringThemes.join("; ") || "(none)"}`,
        quotes,
      ].join("\n");
    })
    .join("\n\n");

  const system = await loadPrompt("synthesizer_report_system", {
    studyTitle: input.studyTitle,
    problemStatement: input.problemStatement,
    researchGoals: input.researchGoals ?? "(none stated)",
    sessionsBlock,
  });

  const prompt = `Write the final research report.

## Study
${input.studyTitle}

## Problem statement
${input.problemStatement}

## Research goals
${input.researchGoals ?? "(none stated)"}

## Session syntheses
${sessionsBlock}

Output structured JSON only.`;

  const result = await generateStructuredOutput({
    system,
    prompt,
    schema: ReportSchema,
  });

  return result.object;
}
