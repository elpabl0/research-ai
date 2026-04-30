import type { ImagePart, ModelMessage, TextPart } from "ai";
import type { PersonaDef } from "@/config/personas";
import { generateStructuredOutput } from "@/lib/ai/provider";
import { formatPersonaBlocks, loadPrompt } from "./prompt-loader";
import {
  InterviewResponseSchema,
  type InterviewResponse,
} from "./schemas/research/interview";
import type {
  InterviewAttachment,
  PlanQuestionContext,
  SessionContext,
  StudyContext,
  TurnContext,
} from "./types";

function studyContextBlock(study: StudyContext): string {
  const parts: string[] = [
    `## Study\n${study.title}`,
    `## Problem statement\n${study.problemStatement}`,
  ];
  if (study.researchGoals?.trim()) {
    parts.push(`## Research goals\n${study.researchGoals.trim()}`);
  }
  if (study.supportingData?.trim()) {
    parts.push(`## Supporting context\n${study.supportingData.trim().slice(0, 4000)}`);
  }
  if (study.artifactSummary?.trim()) {
    parts.push(`## Available artifacts\n${study.artifactSummary.trim()}`);
  }
  return parts.join("\n\n");
}

function priorTurnsBlock(turns: TurnContext["priorTurnSyntheses"]): string {
  if (!turns.length) return "";
  return [
    "## Earlier in this session",
    ...turns.map(
      (t) => `- Q${t.orderIndex + 1}: ${t.questionText}\n  → ${t.summary}`,
    ),
  ].join("\n");
}

/**
 * In group sessions, what other participants have already said about
 * this same question. Lets each persona react to peers as in a real
 * focus group rather than answering in isolation.
 */
export interface PeerResponseSummary {
  personaName: string;
  spoken: string;
}

function peerResponsesBlock(peers: PeerResponseSummary[] | undefined): string {
  if (!peers || peers.length === 0) return "";
  const lines = peers
    .filter((p) => p.spoken && p.spoken.trim())
    .map((p) => `- **${p.personaName}**: "${p.spoken.trim()}"`)
    .join("\n");
  if (!lines) return "";
  return [
    "## What other participants have said about this question",
    lines,
    "(You're in the same room with them. Agree, disagree, build on, or steer the conversation — but stay in your own voice and your own perspective. Don't simply repeat what they said.)",
  ].join("\n\n");
}

function attachmentToImagePart(att: InterviewAttachment): ImagePart {
  return {
    type: "image",
    image: att.data,
    mediaType: att.mimeType,
  };
}

/**
 * Single-question interview response. Optionally accepts attachments which are
 * passed as image parts in the user message.
 */
export async function respondToInterviewQuestion(opts: {
  persona: PersonaDef;
  study: StudyContext;
  session: SessionContext;
  turn: TurnContext;
  question: PlanQuestionContext;
  attachments?: InterviewAttachment[];
  /** Peers who have already answered this question in a group session. */
  priorPeerResponses?: PeerResponseSummary[];
}): Promise<InterviewResponse> {
  const { persona, study, session, turn, question } = opts;

  const system = await loadPrompt(
    "persona_interview_system",
    formatPersonaBlocks(persona),
  );

  const textBlocks: string[] = [
    studyContextBlock(study),
    priorTurnsBlock(turn.priorTurnSyntheses),
    session.runningSummary
      ? `## Running session memory\n${session.runningSummary}`
      : "",
    peerResponsesBlock(opts.priorPeerResponses),
    `## Researcher's question\n${question.questionText}`,
    "Answer naturally, in your own voice. Output structured JSON only.",
  ].filter(Boolean);

  const textPart: TextPart = { type: "text", text: textBlocks.join("\n\n") };
  const imageParts = (opts.attachments ?? []).map(attachmentToImagePart);

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: imageParts.length ? [textPart, ...imageParts] : [textPart],
    },
  ];

  const result = await generateStructuredOutput({
    system,
    messages,
    schema: InterviewResponseSchema,
  });

  return result.object;
}

/**
 * Multi-step screen flow walkthrough. All step images are sent in one
 * multimodal call. The persona returns per-step reactions plus an overall
 * reaction.
 */
export async function respondToSequencedFlow(opts: {
  persona: PersonaDef;
  study: StudyContext;
  session: SessionContext;
  turn: TurnContext;
  question: PlanQuestionContext;
  steps: InterviewAttachment[];
  /** Peers who have already walked through this flow in a group session. */
  priorPeerResponses?: PeerResponseSummary[];
}): Promise<InterviewResponse> {
  const { persona, study, session, turn, question, steps } = opts;

  const system = await loadPrompt(
    "persona_sequenced_flow_system",
    formatPersonaBlocks(persona),
  );

  const stepsManifest = steps
    .map((s, i) => `Step ${i + 1}${s.label ? ` — ${s.label}` : ""}`)
    .join("\n");

  const textBlocks: string[] = [
    studyContextBlock(study),
    priorTurnsBlock(turn.priorTurnSyntheses),
    session.runningSummary
      ? `## Running session memory\n${session.runningSummary}`
      : "",
    peerResponsesBlock(opts.priorPeerResponses),
    `## Researcher's question\n${question.questionText}`,
    `## Flow under review (${steps.length} step${steps.length === 1 ? "" : "s"})\n${stepsManifest}`,
    "Walk through each step in order, then give an overall reaction across the whole flow. Output structured JSON only.",
  ].filter(Boolean);

  const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

  const content: Array<TextPart | ImagePart> = [
    { type: "text", text: textBlocks.join("\n\n") },
  ];
  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    content.push({
      type: "text",
      text: `### Step ${i + 1}${step.label ? ` — ${step.label}` : ""}`,
    });
    content.push(attachmentToImagePart(step));
  }

  const messages: ModelMessage[] = [{ role: "user", content }];

  const result = await generateStructuredOutput({
    system,
    messages,
    schema: InterviewResponseSchema,
  });

  return result.object;
}
