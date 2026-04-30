import { generateStructuredOutput } from "@/lib/ai/provider";
import { loadPrompt } from "./prompt-loader";
import {
  ResearchPlanSchema,
  type ResearchPlan,
} from "./schemas/research/plan";
import {
  FollowUpSchema,
  type FollowUpDecision,
  type InterviewResponse,
} from "./schemas/research/interview";
import type { PersonaDef } from "@/config/personas";
import {
  MAX_FOLLOWUP_DEPTH,
  MAX_FOLLOWUPS_PER_TURN,
} from "@/config/research";
import type { PlanQuestionContext, StudyContext } from "./types";

interface PlanGenerationInput {
  study: StudyContext;
  selectedPersonas: PersonaDef[];
  /** True when the study has any sequenced-flow attachments available. */
  hasFlowArtifacts: boolean;
}

export async function generateResearchPlan(
  input: PlanGenerationInput,
): Promise<ResearchPlan> {
  const { study, selectedPersonas, hasFlowArtifacts } = input;

  const personasBlock = selectedPersonas
    .map(
      (p) =>
        `- ${p.id}: ${p.name} — tech ${p.techComfort}; ${p.description}`,
    )
    .join("\n");

  const flowHint = hasFlowArtifacts
    ? "Some questions can be paired with a multi-step screen flow walkthrough. Tag them with expectedTurnType='sequenced_flow'."
    : "There are no flow artifacts attached, so set expectedTurnType='single' for every question.";

  // System prompt is the stable role description; substitution happens for
  // any prompt that defines {{placeholders}} (the default template doesn't,
  // but a user-customised one might).
  const system = await loadPrompt("researcher_plan_system", {
    studyTitle: study.title,
    problemStatement: study.problemStatement,
    researchGoals: study.researchGoals ?? "(none stated)",
    supportingData: (study.supportingData ?? "").slice(0, 4000),
    artifactSummary: study.artifactSummary,
  });

  // User prompt carries the actual study context — the system template above
  // is just task framing.
  const promptParts: string[] = [
    `## Study title\n${study.title}`,
    `## Problem statement\n${study.problemStatement}`,
  ];
  if (study.researchGoals?.trim()) {
    promptParts.push(`## Research goals\n${study.researchGoals.trim()}`);
  }
  if (study.supportingData?.trim()) {
    promptParts.push(
      `## Supporting documents (extracted text)\n${study.supportingData.trim().slice(0, 4000)}`,
    );
  }
  if (study.artifactSummary?.trim() && study.artifactSummary.trim() !== "(none)") {
    promptParts.push(`## Attached artifacts\n${study.artifactSummary.trim()}`);
  }
  promptParts.push(`## Available personas\n${personasBlock}`);
  promptParts.push(`## Notes\n${flowHint}`);
  promptParts.push(
    "Draft the plan now. Every question must connect to the study title, problem statement, and research goals above — do not produce generic interview questions. Output structured JSON only.",
  );

  const prompt = promptParts.join("\n\n");

  const result = await generateStructuredOutput({
    system,
    prompt,
    schema: ResearchPlanSchema,
  });

  return result.object;
}

interface FollowUpInput {
  question: PlanQuestionContext;
  persona: PersonaDef;
  response: InterviewResponse;
  /** Current depth in the follow-up chain (1-indexed). */
  depth: number;
  /**
   * Every follow-up question already asked of this persona on this question
   * (across the whole chain). Threaded in so the model can avoid repeats —
   * without this it has no memory of the prior depths.
   */
  alreadyAskedFollowUps?: string[];
}

function normaliseQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicateOfAsked(
  candidate: string,
  asked: string[],
): boolean {
  const c = normaliseQuestion(candidate);
  if (!c) return true;
  for (const a of asked) {
    const n = normaliseQuestion(a);
    if (!n) continue;
    if (n === c) return true;
    // Fuzzy-ish: one fully contains the other and shares ≥80% length.
    if (n.length > 0 && c.length > 0) {
      const longer = n.length >= c.length ? n : c;
      const shorter = n.length >= c.length ? c : n;
      if (longer.includes(shorter) && shorter.length / longer.length >= 0.8) {
        return true;
      }
    }
  }
  return false;
}

export async function generateFollowUps(
  input: FollowUpInput,
): Promise<FollowUpDecision> {
  const { question, persona, response, depth, alreadyAskedFollowUps = [] } = input;

  if (depth > MAX_FOLLOWUP_DEPTH) {
    return { followUps: [] };
  }

  const remainingBudget = Math.min(
    MAX_FOLLOWUPS_PER_TURN,
    MAX_FOLLOWUP_DEPTH - depth + 1,
  );

  if (remainingBudget <= 0) {
    return { followUps: [] };
  }

  const askedBlock =
    alreadyAskedFollowUps.length > 0
      ? alreadyAskedFollowUps.map((q, i) => `  ${i + 1}. ${q}`).join("\n")
      : "(none yet)";

  const system = await loadPrompt("researcher_followup_system", {
    originalQuestion: question.questionText,
    personaName: persona.name,
    responseText: response.spoken,
    depth: String(depth),
    maxFollowUps: String(remainingBudget),
    alreadyAsked: askedBlock,
  });

  const prompt = `Decide whether to ask 0–${remainingBudget} follow-up question(s).

## Question that was asked
${question.questionText}

## Participant: ${persona.name}
${response.spoken}

Pain points: ${response.painPoints.join("; ") || "(none)"}
Confusion: ${response.confusionPoints.join("; ") || "(none)"}
Delights: ${response.delights.join("; ") || "(none)"}

## Follow-up questions already asked of ${persona.name} for this question
${askedBlock}

Do NOT repeat any of the already-asked questions, even with rephrased wording. If you cannot ask something genuinely new and useful, return an empty list.

Output structured JSON only.`;

  const result = await generateStructuredOutput({
    system,
    prompt,
    schema: FollowUpSchema,
  });

  // Defensive client-side de-dup so a duplicate slipping through still gets
  // dropped before it's persisted/streamed.
  const candidates = (result.object.followUps ?? []).slice(0, remainingBudget);
  const accepted: typeof candidates = [];
  const seen = [...alreadyAskedFollowUps];
  for (const c of candidates) {
    if (!c.question) continue;
    if (isDuplicateOfAsked(c.question, seen)) continue;
    accepted.push(c);
    seen.push(c.question);
  }

  return { followUps: accepted };
}
