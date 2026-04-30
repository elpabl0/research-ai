import { nanoid } from "nanoid";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  studies,
  studyArtifacts,
  researchPlans,
  planQuestions,
  questionAttachments,
  sessions as sessionsTable,
  turns as turnsTable,
  responses as responsesTable,
  followUps as followUpsTable,
  synthesis as synthesisTable,
  reportSections,
} from "@/lib/db/schema";
import { researchEventBus } from "@/lib/research-event-bus";
import { loadPersona } from "@/lib/agents/prompt-loader";
import {
  respondToInterviewQuestion,
  respondToSequencedFlow,
  type PeerResponseSummary,
} from "@/lib/agents/persona";
import { generateFollowUps } from "@/lib/agents/researcher";
import {
  synthesizeTurn,
  synthesizeSession,
  generateReport,
} from "@/lib/agents/synthesizer";
import { loadAttachmentsForPrompt } from "@/lib/uploads/load-for-prompt";
import {
  MAX_FOLLOWUP_DEPTH,
  MAX_FOLLOWUPS_PER_TURN,
} from "@/config/research";
import type { PersonaDef } from "@/config/personas";
import type {
  InterviewAttachment,
  PlanQuestionContext,
  SessionContext,
  StreamEvent,
  StudyContext,
  TurnContext,
} from "@/lib/agents/types";
import type {
  InterviewResponse,
  StepReaction,
} from "@/lib/agents/schemas/research/interview";
import type {
  TurnSynthesis,
  SessionSynthesis,
  Report,
  ReportTheme,
  ReportFinding,
  ReportRecommendation,
  PerPersonaFinding,
} from "@/lib/agents/schemas/research/synthesis";

const activeRuns = new Map<string, AbortController>();

/** Wrap a DB op so failures carry a label identifying which operation died. */
async function dbOp<T>(label: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err: unknown) {
    if (err instanceof Error) {
      const tagged = new Error(`[${label}] ${err.message}`);
      (tagged as { cause?: unknown }).cause = err;
      if ("code" in err) {
        (tagged as { code?: unknown }).code = (err as { code: unknown }).code;
      }
      tagged.stack = err.stack;
      throw tagged;
    }
    throw err;
  }
}

export function isRunning(studyId: string): boolean {
  return activeRuns.has(studyId);
}

export function abortRun(studyId: string): void {
  const ctrl = activeRuns.get(studyId);
  if (ctrl) ctrl.abort();
}

export function runStudyInBackground(studyId: string): void {
  if (activeRuns.has(studyId)) return;
  const controller = new AbortController();
  activeRuns.set(studyId, controller);

  void runStudy(studyId, controller.signal)
    .catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      // Surface the real error in the dev terminal — easy to miss otherwise
      // because the runner is detached from the request that started it.
      const errorDetails: Record<string, unknown> = { message };
      if (err instanceof Error) {
        errorDetails.stack = err.stack;
      }
      if (err && typeof err === "object") {
        if ("code" in err) errorDetails.code = (err as { code: unknown }).code;
        if ("cause" in err) errorDetails.cause = (err as { cause: unknown }).cause;
      }
      console.error(
        `[research-runner] study ${studyId} failed:`,
        errorDetails,
      );
      emit(studyId, { type: "error", data: { message } });
      // Persist the error so SSE reconnections after the in-memory channel
      // is gone can still surface the real reason instead of a generic
      // "Study was interrupted." message.
      try {
        const study = await db.query.studies.findFirst({
          where: eq(studies.id, studyId),
        });
        const config = study?.config ? JSON.parse(study.config) : {};
        config.lastError = message;
        await db
          .update(studies)
          .set({
            status: "interrupted",
            config: JSON.stringify(config),
            updatedAt: new Date(),
          })
          .where(eq(studies.id, studyId));
      } catch (persistErr) {
        console.error(
          `[research-runner] failed to persist study error:`,
          persistErr,
        );
      }
    })
    .finally(() => {
      activeRuns.delete(studyId);
      researchEventBus.scheduleCleanup(studyId);
    });
}

/**
 * Clear the persisted lastError on a study (called when a fresh run starts).
 */
export async function clearStudyError(studyId: string): Promise<void> {
  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) return;
  const config = study.config ? JSON.parse(study.config) : {};
  if ("lastError" in config) {
    delete config.lastError;
    await db
      .update(studies)
      .set({ config: JSON.stringify(config), updatedAt: new Date() })
      .where(eq(studies.id, studyId));
  }
}

function emit(studyId: string, event: StreamEvent) {
  researchEventBus.emit(studyId, event);
}

// ── Loading helpers ──────────────────────────────────────

async function buildStudyContext(studyId: string): Promise<StudyContext> {
  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) throw new Error(`Study ${studyId} not found`);

  const artifacts = await db.query.studyArtifacts.findMany({
    where: eq(studyArtifacts.studyId, studyId),
  });

  const supportingData = artifacts
    .filter((a) => a.kind === "document" && a.extractedText)
    .map((a) => `### ${a.filename}\n${a.extractedText}`)
    .join("\n\n");

  const artifactSummary = artifacts.length
    ? artifacts
        .map((a) => `- ${a.kind}: ${a.filename}`)
        .join("\n")
    : "(none)";

  return {
    studyId,
    title: study.title,
    problemStatement: study.problemStatement,
    researchGoals: study.researchGoals ?? undefined,
    supportingData,
    artifactSummary,
    sessionMode: study.sessionMode,
  };
}

async function loadSelectedPersonas(studyId: string): Promise<PersonaDef[]> {
  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) throw new Error(`Study ${studyId} not found`);
  const config: { selectedPersonaIds?: string[] } = study.config
    ? JSON.parse(study.config)
    : {};
  const ids = config.selectedPersonaIds ?? [];

  const loaded: PersonaDef[] = [];
  for (const id of ids) {
    const p = await loadPersona(id);
    if (p) loaded.push(p);
  }
  return loaded;
}

interface LoadedQuestion extends PlanQuestionContext {
  assignedPersonaIds: string[];
}

async function loadPlanQuestions(studyId: string): Promise<LoadedQuestion[]> {
  const plan = await db.query.researchPlans.findFirst({
    where: eq(researchPlans.studyId, studyId),
  });
  if (!plan) throw new Error(`Plan for study ${studyId} not found`);

  const questions = await db.query.planQuestions.findMany({
    where: eq(planQuestions.planId, plan.id),
    orderBy: [asc(planQuestions.orderIndex)],
  });

  const result: LoadedQuestion[] = [];
  for (const q of questions) {
    const attachmentRows = await db.query.questionAttachments.findMany({
      where: eq(questionAttachments.questionId, q.id),
      orderBy: [asc(questionAttachments.orderIndex)],
    });
    const attachments = await loadAttachmentsForPrompt(attachmentRows);
    result.push({
      id: q.id,
      orderIndex: q.orderIndex,
      questionText: q.questionText,
      expectedTurnType: q.expectedTurnType,
      attachments,
      assignedPersonaIds: JSON.parse(q.assignedPersonaIds) as string[],
    });
  }
  return result;
}

// ── Per-turn execution ───────────────────────────────────

interface RunningResponse {
  id: string;
  personaId: string;
  personaName: string;
  kind: "initial" | "follow_up";
  parentResponseId: string | null;
  questionAsked: string;
  response: InterviewResponse;
}

async function persistResponse(
  studyId: string,
  turnId: string,
  rr: RunningResponse,
): Promise<void> {
  await dbOp(`insert response (turnId=${turnId} responseId=${rr.id} kind=${rr.kind})`, () =>
    db.insert(responsesTable).values({
      id: rr.id,
      turnId,
      personaId: rr.personaId,
      personaName: rr.personaName,
      kind: rr.kind,
      parentResponseId: rr.parentResponseId,
      questionAsked: rr.questionAsked,
      responseText: rr.response.spoken,
      structuredOutput: JSON.stringify(rr.response),
    }),
  );

  emit(studyId, {
    type: "response_received",
    data: {
      turnId,
      responseId: rr.id,
      personaId: rr.personaId,
      personaName: rr.personaName,
      kind: rr.kind,
      questionAsked: rr.questionAsked,
      spoken: rr.response.spoken,
      sentiment: rr.response.sentiment,
      painPoints: rr.response.painPoints,
      delights: rr.response.delights,
      confusionPoints: rr.response.confusionPoints,
      stepReactions: rr.response.stepReactions ?? null,
      overallReaction: rr.response.overallReaction ?? null,
    },
  });
}

async function askPersona(opts: {
  persona: PersonaDef;
  study: StudyContext;
  session: SessionContext;
  turn: TurnContext;
  question: PlanQuestionContext;
  attachments: InterviewAttachment[];
  signal: AbortSignal;
  /** Peers who have already answered this question (group mode). */
  priorPeerResponses?: PeerResponseSummary[];
}): Promise<InterviewResponse> {
  if (opts.signal.aborted) throw new Error("aborted");

  if (opts.question.expectedTurnType === "sequenced_flow" && opts.attachments.length > 0) {
    return respondToSequencedFlow({
      persona: opts.persona,
      study: opts.study,
      session: opts.session,
      turn: opts.turn,
      question: opts.question,
      steps: opts.attachments,
      priorPeerResponses: opts.priorPeerResponses,
    });
  }
  return respondToInterviewQuestion({
    persona: opts.persona,
    study: opts.study,
    session: opts.session,
    turn: opts.turn,
    question: opts.question,
    attachments: opts.attachments.length ? opts.attachments : undefined,
    priorPeerResponses: opts.priorPeerResponses,
  });
}

async function runFollowUpChain(opts: {
  studyId: string;
  turnId: string;
  question: PlanQuestionContext;
  persona: PersonaDef;
  parentResponseId: string;
  parentResponse: InterviewResponse;
  study: StudyContext;
  session: SessionContext;
  turn: TurnContext;
  signal: AbortSignal;
  collected: RunningResponse[];
  /**
   * In group mode, the initial responses from the other participants on this
   * same question. Threaded through every follow-up so the persona can refer
   * to them when responding (e.g. "Daniel said X, but for me…").
   */
  priorPeerResponses?: PeerResponseSummary[];
}): Promise<void> {
  const {
    studyId,
    turnId,
    question,
    persona,
    parentResponseId,
    parentResponse,
    study,
    session,
    turn,
    signal,
    collected,
    priorPeerResponses,
  } = opts;

  let depth = 1;
  let currentParentId = parentResponseId;
  let currentParentResponse = parentResponse;
  /**
   * Every follow-up question text we've actually asked this persona during
   * this turn — passed back into the model so it doesn't re-ask the same
   * thing at a deeper depth (the model otherwise has no memory of prior
   * depths in the chain).
   */
  const askedThisTurn: string[] = [];

  while (depth <= MAX_FOLLOWUP_DEPTH) {
    if (signal.aborted) return;

    const decision = await generateFollowUps({
      question,
      persona,
      response: currentParentResponse,
      depth,
      alreadyAskedFollowUps: askedThisTurn,
    });

    const followUps = decision.followUps.slice(0, MAX_FOLLOWUPS_PER_TURN);
    if (!followUps.length) return;

    let lastResponseId = currentParentId;
    let lastResponse: InterviewResponse | null = null;

    for (let i = 0; i < followUps.length; i++) {
      if (signal.aborted) return;
      const fu = followUps[i];
      askedThisTurn.push(fu.question);
      const fuId = nanoid(10);
      await dbOp(
        `insert follow_up (turnId=${turnId} parentResponseId=${currentParentId} fuId=${fuId} depth=${depth})`,
        () =>
          db.insert(followUpsTable).values({
            id: fuId,
            turnId,
            parentResponseId: currentParentId,
            orderIndex: i,
            questionText: fu.question,
            rationale: fu.rationale ?? null,
            depth,
          }),
      );

      emit(studyId, {
        type: "follow_up_asked",
        data: {
          turnId,
          followUpId: fuId,
          parentResponseId: currentParentId,
          personaId: persona.id,
          personaName: persona.name,
          question: fu.question,
          rationale: fu.rationale ?? null,
          depth,
        },
      });

      const followUpQuestion: PlanQuestionContext = {
        ...question,
        questionText: fu.question,
        expectedTurnType: "single",
        attachments: [],
      };
      const response = await askPersona({
        persona,
        study,
        session,
        turn,
        question: followUpQuestion,
        attachments: [],
        signal,
        priorPeerResponses,
      });

      const responseId = nanoid(10);
      const rr: RunningResponse = {
        id: responseId,
        personaId: persona.id,
        personaName: persona.name,
        kind: "follow_up",
        parentResponseId: currentParentId,
        questionAsked: fu.question,
        response,
      };
      await persistResponse(studyId, turnId, rr);
      collected.push(rr);

      lastResponseId = responseId;
      lastResponse = response;
    }

    if (!lastResponse) return;
    currentParentId = lastResponseId;
    currentParentResponse = lastResponse;
    depth += 1;
  }
}

async function runTurn(opts: {
  studyId: string;
  study: StudyContext;
  session: SessionContext;
  question: LoadedQuestion;
  orderIndex: number;
  priorTurnSyntheses: TurnContext["priorTurnSyntheses"];
  participants: PersonaDef[];
  signal: AbortSignal;
}): Promise<{ turnId: string; turnSynthesis: TurnSynthesis; collected: RunningResponse[] }> {
  const {
    studyId,
    study,
    session,
    question,
    orderIndex,
    priorTurnSyntheses,
    participants,
    signal,
  } = opts;

  const turnId = nanoid(10);
  await dbOp(
    `insert turn (sessionId=${session.sessionId} planQuestionId=${question.id} turnId=${turnId} orderIndex=${orderIndex})`,
    () =>
      db.insert(turnsTable).values({
        id: turnId,
        sessionId: session.sessionId,
        planQuestionId: question.id,
        orderIndex,
        status: "running",
      }),
  );

  emit(studyId, {
    type: "turn_start",
    data: {
      turnId,
      sessionId: session.sessionId,
      orderIndex,
      questionId: question.id,
      questionText: question.questionText,
      expectedTurnType: question.expectedTurnType,
      hasAttachments: question.attachments.length > 0,
    },
  });

  // Rotate the speaking order each turn in group mode so the same persona
  // doesn't always go first (and therefore always speak without seeing peers).
  // 1-on-1 mode runs once, so rotation is a no-op.
  const speakingOrder =
    session.mode === "group" && participants.length > 1
      ? [
          ...participants.slice(orderIndex % participants.length),
          ...participants.slice(0, orderIndex % participants.length),
        ]
      : participants;

  emit(studyId, {
    type: "question_asked",
    data: {
      turnId,
      questionText: question.questionText,
      askedTo: speakingOrder.map((p) => p.id),
    },
  });

  const turn: TurnContext = {
    turnId,
    question,
    priorTurnSyntheses,
  };

  const collected: RunningResponse[] = [];

  // Initial responses.
  // Group mode: walk participants sequentially so each persona sees what the
  // earlier speakers said about this question, mimicking a real focus group.
  // 1-on-1 mode: there's only one persona per session, so this loop runs once.
  const initialResponses: Array<{
    persona: PersonaDef;
    response: InterviewResponse;
    responseId: string;
  }> = [];
  const peerSummaries: PeerResponseSummary[] = [];

  for (const persona of speakingOrder) {
    if (signal.aborted) break;
    const response = await askPersona({
      persona,
      study,
      session,
      turn,
      question,
      attachments: question.attachments,
      signal,
      priorPeerResponses:
        session.mode === "group" && peerSummaries.length > 0
          ? [...peerSummaries]
          : undefined,
    });
    const responseId = nanoid(10);
    const rr: RunningResponse = {
      id: responseId,
      personaId: persona.id,
      personaName: persona.name,
      kind: "initial",
      parentResponseId: null,
      questionAsked: question.questionText,
      response,
    };
    await persistResponse(studyId, turnId, rr);
    collected.push(rr);
    initialResponses.push({ persona, response, responseId });
    if (session.mode === "group") {
      peerSummaries.push({ personaName: persona.name, spoken: response.spoken });
    }
  }

  // Follow-up chains — one chain per persona that gave the initial response.
  // In group mode, each persona's follow-ups also see the other personas'
  // initial answers (excluding their own) so probes can reference what others
  // said.
  const allPeerSummaries: PeerResponseSummary[] = initialResponses.map((r) => ({
    personaName: r.persona.name,
    spoken: r.response.spoken,
  }));

  for (const { persona, response, responseId } of initialResponses) {
    if (signal.aborted) break;
    const peersForThisChain =
      session.mode === "group"
        ? allPeerSummaries.filter((p) => p.personaName !== persona.name)
        : undefined;
    await runFollowUpChain({
      studyId,
      turnId,
      question,
      persona,
      parentResponseId: responseId,
      parentResponse: response,
      study,
      session,
      turn,
      signal,
      collected,
      priorPeerResponses:
        peersForThisChain && peersForThisChain.length > 0
          ? peersForThisChain
          : undefined,
    });
  }

  // Per-turn synthesis.
  const turnSynthesis = await synthesizeTurn({
    questionText: question.questionText,
    responses: collected.map((r) => ({
      personaId: r.personaId,
      personaName: r.personaName,
      kind: r.kind,
      questionAsked: r.questionAsked,
      response: r.response,
    })),
  });

  await dbOp(
    `insert synthesis (kind=turn studyId=${studyId} sessionId=${session.sessionId} turnId=${turnId})`,
    () =>
      db.insert(synthesisTable).values({
        id: nanoid(10),
        studyId,
        sessionId: session.sessionId,
        turnId,
        kind: "turn",
        text: turnSynthesis.summary,
        structuredOutput: JSON.stringify(turnSynthesis),
      }),
  );

  await db
    .update(turnsTable)
    .set({
      status: "completed",
      synthesisText: turnSynthesis.summary,
      completedAt: new Date(),
    })
    .where(eq(turnsTable.id, turnId));

  emit(studyId, {
    type: "turn_synthesis",
    data: {
      turnId,
      sessionId: session.sessionId,
      summary: turnSynthesis.summary,
      keyPoints: turnSynthesis.keyPoints,
      surprises: turnSynthesis.surprises,
      openQuestions: turnSynthesis.openQuestions,
    },
  });

  return { turnId, turnSynthesis, collected };
}

// ── Per-session execution ────────────────────────────────

async function runSession(opts: {
  studyId: string;
  study: StudyContext;
  questions: LoadedQuestion[];
  participants: PersonaDef[];
  mode: "one_on_one" | "group";
  signal: AbortSignal;
}): Promise<{ sessionId: string; persona: PersonaDef; sessionSynthesis: SessionSynthesis }> {
  const { studyId, study, questions, participants, mode, signal } = opts;

  const sessionId = nanoid(10);
  const personaSnapshot = JSON.stringify(participants);
  const primaryPersona = participants[0];

  await dbOp(
    `insert session (sessionId=${sessionId} studyId=${studyId} personaId=${primaryPersona.id} mode=${mode})`,
    () =>
      db.insert(sessionsTable).values({
        id: sessionId,
        studyId,
        personaId: mode === "one_on_one" ? primaryPersona.id : null,
        personaSnapshot,
        mode,
        status: "running",
        startedAt: new Date(),
      }),
  );

  emit(studyId, {
    type: "session_start",
    data: {
      sessionId,
      mode,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
      })),
    },
  });

  const session: SessionContext = {
    sessionId,
    mode,
    personas: participants,
    runningSummary: "",
  };

  const turnRecords: Array<{
    orderIndex: number;
    questionText: string;
    turnSynthesis: TurnSynthesis;
    responses: Array<{
      personaId: string;
      personaName: string;
      kind: "initial" | "follow_up";
      questionAsked: string;
      response: InterviewResponse;
    }>;
  }> = [];

  let priorTurnSyntheses: TurnContext["priorTurnSyntheses"] = [];

  for (let i = 0; i < questions.length; i++) {
    if (signal.aborted) break;
    const question = questions[i];

    // Filter participants by this question's persona assignment.
    // If assignedPersonaIds is empty, every selected persona answers.
    const assigned = question.assignedPersonaIds.length
      ? participants.filter((p) => question.assignedPersonaIds.includes(p.id))
      : participants;
    if (!assigned.length) continue;

    const { turnSynthesis, collected } = await runTurn({
      studyId,
      study,
      session,
      question,
      orderIndex: i,
      priorTurnSyntheses,
      participants: assigned,
      signal,
    });

    priorTurnSyntheses = [
      ...priorTurnSyntheses,
      {
        orderIndex: i,
        questionText: question.questionText,
        summary: turnSynthesis.summary,
      },
    ];
    session.runningSummary = priorTurnSyntheses
      .map((t) => `Q${t.orderIndex + 1}: ${t.summary}`)
      .join("\n");

    turnRecords.push({
      orderIndex: i,
      questionText: question.questionText,
      turnSynthesis,
      responses: collected.map((r) => ({
        personaId: r.personaId,
        personaName: r.personaName,
        kind: r.kind,
        questionAsked: r.questionAsked,
        response: r.response,
      })),
    });
  }

  // Per-session synthesis. For group mode, we synthesise per persona using
  // each persona's own contributions.
  const synthesisPersona = primaryPersona;
  const sessionSynthesis = await synthesizeSession({
    persona: synthesisPersona,
    turns: turnRecords,
  });

  await dbOp(
    `insert synthesis (kind=session studyId=${studyId} sessionId=${sessionId})`,
    () =>
      db.insert(synthesisTable).values({
        id: nanoid(10),
        studyId,
        sessionId,
        kind: "session",
        text: sessionSynthesis.narrative,
        structuredOutput: JSON.stringify(sessionSynthesis),
      }),
  );

  await db
    .update(sessionsTable)
    .set({
      status: "completed",
      summary: sessionSynthesis.narrative,
      completedAt: new Date(),
    })
    .where(eq(sessionsTable.id, sessionId));

  emit(studyId, {
    type: "session_synthesis",
    data: {
      sessionId,
      personaId: synthesisPersona.id,
      personaName: synthesisPersona.name,
      narrative: sessionSynthesis.narrative,
      topFrustrations: sessionSynthesis.topFrustrations,
      topDelights: sessionSynthesis.topDelights,
      recurringThemes: sessionSynthesis.recurringThemes,
      standoutQuotes: sessionSynthesis.standoutQuotes,
    },
  });

  emit(studyId, {
    type: "session_complete",
    data: { sessionId },
  });

  return { sessionId, persona: synthesisPersona, sessionSynthesis };
}

// ── Final report ─────────────────────────────────────────

async function persistReport(studyId: string, report: Report): Promise<void> {
  await dbOp(
    `insert synthesis (kind=report studyId=${studyId})`,
    () =>
      db.insert(synthesisTable).values({
        id: nanoid(10),
        studyId,
        kind: "report",
        text: report.executiveSummary,
        structuredOutput: JSON.stringify(report),
      }),
  );

  // Also break out into editable sections.
  const sections: Array<{ key: string; content: string; structured: unknown }> = [
    {
      key: "executive_summary",
      content: report.executiveSummary,
      structured: { executiveSummary: report.executiveSummary, sampleCaveat: report.sampleCaveat },
    },
    {
      key: "key_findings",
      content: report.keyFindings
        .map(
          (f: ReportFinding, i: number) =>
            `${i + 1}. **${f.finding}** _(evidence: ${f.evidenceStrength}; personas: ${f.contributingPersonaIds.join(", ") || "—"})_`,
        )
        .join("\n"),
      structured: report.keyFindings,
    },
    {
      key: "themes",
      content: report.themes
        .map(
          (t: ReportTheme) =>
            `### ${t.name}\n${t.description}\n${t.supportingQuotes
              .map((q) => `> "${q.quote}" — ${q.personaId}`)
              .join("\n")}`,
        )
        .join("\n\n"),
      structured: report.themes,
    },
    {
      key: "per_persona",
      content: report.perPersonaFindings
        .map((p: PerPersonaFinding) => `**${p.personaName}:** ${p.distinctive}`)
        .join("\n\n"),
      structured: report.perPersonaFindings,
    },
    {
      key: "recommendations",
      content: report.recommendations
        .map(
          (r: ReportRecommendation) =>
            `- _[${r.priority}]_ ${r.action}`,
        )
        .join("\n"),
      structured: report.recommendations,
    },
    {
      key: "open_questions",
      content: report.openQuestions.map((q: string) => `- ${q}`).join("\n"),
      structured: report.openQuestions,
    },
  ];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    await dbOp(
      `insert reportSection (studyId=${studyId} key=${s.key} orderIndex=${i})`,
      () =>
        db.insert(reportSections).values({
          id: nanoid(10),
          studyId,
          sectionKey: s.key as
            | "executive_summary"
            | "key_findings"
            | "themes"
            | "per_persona"
            | "recommendations"
            | "open_questions",
          orderIndex: i,
          content: s.content,
          structuredOutput: JSON.stringify(s.structured),
        }),
    );
  }
}

// ── Top-level orchestration ──────────────────────────────

async function runStudy(studyId: string, signal: AbortSignal): Promise<void> {
  await db
    .update(studies)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(studies.id, studyId));

  emit(studyId, { type: "study_start", data: { studyId } });

  const study = await buildStudyContext(studyId);
  const personas = await loadSelectedPersonas(studyId);
  if (!personas.length) throw new Error("No personas selected for this study.");

  const allQuestions = await loadPlanQuestions(studyId);
  if (!allQuestions.length) throw new Error("Plan has no questions.");

  let sessionResults: Array<{
    sessionId: string;
    persona: PersonaDef;
    sessionSynthesis: SessionSynthesis;
  }>;

  if (study.sessionMode === "group") {
    const result = await runSession({
      studyId,
      study,
      questions: allQuestions,
      participants: personas,
      mode: "group",
      signal,
    });
    sessionResults = [result];
  } else {
    sessionResults = await Promise.all(
      personas.map((persona) =>
        runSession({
          studyId,
          study,
          questions: allQuestions,
          participants: [persona],
          mode: "one_on_one",
          signal,
        }),
      ),
    );
  }

  if (signal.aborted) return;

  const report = await generateReport({
    studyTitle: study.title,
    problemStatement: study.problemStatement,
    researchGoals: study.researchGoals,
    sessions: sessionResults.map((s) => ({
      persona: s.persona,
      sessionSynthesis: s.sessionSynthesis,
    })),
  });

  await persistReport(studyId, report);

  emit(studyId, {
    type: "report_generated",
    data: {
      executiveSummary: report.executiveSummary,
      keyFindings: report.keyFindings,
      themes: report.themes,
      perPersonaFindings: report.perPersonaFindings,
      recommendations: report.recommendations,
      openQuestions: report.openQuestions,
      sampleCaveat: report.sampleCaveat,
    },
  });

  await db
    .update(studies)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(studies.id, studyId));

  emit(studyId, { type: "study_complete", data: { studyId } });
}

// Keep StepReaction in the module's exported surface so consumers can import.
export type { StepReaction };
