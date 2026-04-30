import { db } from "@/lib/db";
import {
  studies,
  sessions as sessionsTable,
  turns as turnsTable,
  responses as responsesTable,
  followUps as followUpsTable,
  planQuestions,
  reportSections,
} from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SessionParticipant {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

interface PersonaSnapshot {
  participants?: SessionParticipant[];
}

/**
 * Returns a fully-hydrated, persisted transcript for a study — sessions →
 * turns → responses → follow-ups, plus optional report fields. Shaped to
 * match what the live SSE stream emits, so the same UI can render either.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;

  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const sessionRows = await db.query.sessions.findMany({
    where: eq(sessionsTable.studyId, studyId),
  });
  if (sessionRows.length === 0) {
    return NextResponse.json({
      sessions: [],
      report: null,
      studyComplete: study.status === "completed",
    });
  }

  const sessionIds = sessionRows.map((s) => s.id);
  const turnRows = await db.query.turns.findMany({
    where: inArray(turnsTable.sessionId, sessionIds),
    orderBy: [asc(turnsTable.orderIndex)],
  });
  const turnIds = turnRows.map((t) => t.id);

  const planQuestionIds = Array.from(
    new Set(turnRows.map((t) => t.planQuestionId)),
  );
  const planQuestionRows = planQuestionIds.length
    ? await db.query.planQuestions.findMany({
        where: inArray(planQuestions.id, planQuestionIds),
      })
    : [];
  const questionById = new Map(
    planQuestionRows.map((q) => [q.id, q] as const),
  );

  const responseRows = turnIds.length
    ? await db.query.responses.findMany({
        where: inArray(responsesTable.turnId, turnIds),
        orderBy: [asc(responsesTable.createdAt)],
      })
    : [];
  const followUpRows = turnIds.length
    ? await db.query.followUps.findMany({
        where: inArray(followUpsTable.turnId, turnIds),
        orderBy: [asc(followUpsTable.depth), asc(followUpsTable.orderIndex)],
      })
    : [];

  const responsesByTurn = new Map<string, typeof responseRows>();
  for (const r of responseRows) {
    const arr = responsesByTurn.get(r.turnId) ?? [];
    arr.push(r);
    responsesByTurn.set(r.turnId, arr);
  }
  const followUpsByTurn = new Map<string, typeof followUpRows>();
  for (const f of followUpRows) {
    const arr = followUpsByTurn.get(f.turnId) ?? [];
    arr.push(f);
    followUpsByTurn.set(f.turnId, arr);
  }
  const turnsBySession = new Map<string, typeof turnRows>();
  for (const t of turnRows) {
    const arr = turnsBySession.get(t.sessionId) ?? [];
    arr.push(t);
    turnsBySession.set(t.sessionId, arr);
  }

  const sessions = sessionRows.map((s) => {
    let snapshot: PersonaSnapshot = {};
    try {
      snapshot = s.personaSnapshot
        ? (JSON.parse(s.personaSnapshot) as PersonaSnapshot)
        : {};
    } catch {
      /* ignore */
    }
    const participants = snapshot.participants ?? [];
    const sessionTurns = (turnsBySession.get(s.id) ?? []).map((t) => {
      const planQ = questionById.get(t.planQuestionId);
      const turnResponses = (responsesByTurn.get(t.id) ?? []).map((r) => {
        let structured: Record<string, unknown> | null = null;
        if (r.structuredOutput) {
          try {
            structured = JSON.parse(r.structuredOutput);
          } catch {
            structured = null;
          }
        }
        const sentiment =
          (structured?.sentiment as string | undefined) ?? "neutral";
        const painPoints =
          (structured?.painPoints as string[] | undefined) ?? [];
        const delights =
          (structured?.delights as string[] | undefined) ?? [];
        const confusionPoints =
          (structured?.confusionPoints as string[] | undefined) ?? [];
        const stepReactions =
          (structured?.stepReactions as
            | Array<{
                stepIndex: number;
                stepLabel?: string | null;
                reaction: string;
                painPoints: string[];
                delights: string[];
              }>
            | null
            | undefined) ?? null;
        const overallReaction =
          (structured?.overallReaction as string | null | undefined) ?? null;
        return {
          responseId: r.id,
          personaId: r.personaId,
          personaName: r.personaName,
          kind: r.kind,
          questionAsked: r.questionAsked,
          spoken: r.responseText,
          sentiment,
          painPoints,
          delights,
          confusionPoints,
          stepReactions,
          overallReaction,
        };
      });
      const turnFollowUps = (followUpsByTurn.get(t.id) ?? []).map((f) => ({
        followUpId: f.id,
        parentResponseId: f.parentResponseId,
        personaId: turnResponses.find((r) => r.responseId === f.parentResponseId)
          ?.personaId ?? "",
        personaName: turnResponses.find(
          (r) => r.responseId === f.parentResponseId,
        )?.personaName ?? "",
        question: f.questionText,
        rationale: f.rationale,
        depth: f.depth,
      }));
      let synthesisObj:
        | {
            summary: string;
            keyPoints: Array<{ point: string; personaId: string }>;
            surprises: string[];
            openQuestions: string[];
          }
        | undefined;
      if (t.synthesisText) {
        synthesisObj = {
          summary: t.synthesisText,
          keyPoints: [],
          surprises: [],
          openQuestions: [],
        };
      }
      return {
        turnId: t.id,
        orderIndex: t.orderIndex,
        questionText: planQ?.questionText ?? "",
        expectedTurnType: planQ?.expectedTurnType ?? "single",
        status: t.status,
        responses: turnResponses,
        followUps: turnFollowUps,
        synthesis: synthesisObj,
      };
    });
    return {
      sessionId: s.id,
      mode: s.mode,
      participants,
      status: s.status === "interrupted" ? "completed" : s.status,
      turns: sessionTurns,
      synthesis: s.summary
        ? {
            personaId: s.personaId ?? "",
            personaName: participants[0]?.name ?? "",
            narrative: s.summary,
            topFrustrations: [],
            topDelights: [],
            recurringThemes: [],
            standoutQuotes: [],
          }
        : undefined,
    };
  });

  // Surface the report for the run page's "complete" state.
  const reportRows = await db.query.reportSections.findMany({
    where: eq(reportSections.studyId, studyId),
    orderBy: [asc(reportSections.orderIndex)],
  });
  const summarySection = reportRows.find(
    (r) => r.sectionKey === "executive_summary",
  );
  const report = summarySection
    ? {
        executiveSummary: summarySection.content,
        keyFindings: [],
        themes: [],
        perPersonaFindings: [],
        recommendations: [],
        openQuestions: [],
        sampleCaveat: "",
      }
    : null;

  return NextResponse.json({
    sessions,
    report,
    studyComplete: study.status === "completed",
  });
}
