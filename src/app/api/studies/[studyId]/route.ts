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
import { eq, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

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

  const artifacts = await db.query.studyArtifacts.findMany({
    where: eq(studyArtifacts.studyId, studyId),
  });

  const plan = await db.query.researchPlans.findFirst({
    where: eq(researchPlans.studyId, studyId),
  });

  const questions = plan
    ? await db.query.planQuestions.findMany({
        where: eq(planQuestions.planId, plan.id),
        orderBy: [asc(planQuestions.orderIndex)],
      })
    : [];

  const questionIds = questions.map((q) => q.id);
  const attachmentRows = questionIds.length
    ? await db.query.questionAttachments.findMany({
        where: inArray(questionAttachments.questionId, questionIds),
        orderBy: [asc(questionAttachments.orderIndex)],
      })
    : [];
  const attachmentsByQuestion = new Map<string, typeof attachmentRows>();
  for (const att of attachmentRows) {
    const arr = attachmentsByQuestion.get(att.questionId) ?? [];
    arr.push(att);
    attachmentsByQuestion.set(att.questionId, arr);
  }

  const sessions = await db.query.sessions.findMany({
    where: eq(sessionsTable.studyId, studyId),
  });

  const sectionRows = await db.query.reportSections.findMany({
    where: eq(reportSections.studyId, studyId),
    orderBy: [asc(reportSections.orderIndex)],
  });

  return NextResponse.json({
    study,
    artifacts,
    plan: plan ?? null,
    questions: questions.map((q) => ({
      ...q,
      assignedPersonaIds: JSON.parse(q.assignedPersonaIds),
      attachments: (attachmentsByQuestion.get(q.id) ?? []).map((a) => ({
        id: a.id,
        orderIndex: a.orderIndex,
        filename: a.filename,
        path: a.path,
        mimeType: a.mimeType,
        label: a.label,
      })),
    })),
    sessions,
    reportSections: sectionRows,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;
  const body = (await request.json()) as Partial<{
    title: string;
    problemStatement: string;
    researchGoals: string | null;
    sessionMode: "one_on_one" | "group";
    selectedPersonaIds: string[];
    status:
      | "draft"
      | "planning"
      | "plan_ready"
      | "running"
      | "completed"
      | "interrupted";
  }>;

  const existing = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!existing) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.problemStatement !== undefined)
    updates.problemStatement = body.problemStatement;
  if (body.researchGoals !== undefined)
    updates.researchGoals = body.researchGoals;
  if (body.sessionMode !== undefined) updates.sessionMode = body.sessionMode;
  if (body.status !== undefined) updates.status = body.status;
  if (body.selectedPersonaIds !== undefined) {
    const config = existing.config ? JSON.parse(existing.config) : {};
    config.selectedPersonaIds = body.selectedPersonaIds;
    updates.config = JSON.stringify(config);
  }

  await db.update(studies).set(updates).where(eq(studies.id, studyId));
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;

  // Cascade delete (FK constraints aren't ON DELETE CASCADE in our schema, so
  // we do it manually). The order matters: child tables before their parents,
  // and turns reference planQuestions.planQuestionId so all session/turn data
  // must be deleted before we touch planQuestions.
  const plan = await db.query.researchPlans.findFirst({
    where: eq(researchPlans.studyId, studyId),
  });
  const planQs = plan
    ? await db.query.planQuestions.findMany({
        where: eq(planQuestions.planId, plan.id),
      })
    : [];

  // 1. Sessions → turns → responses → follow-ups
  const sessRows = await db.query.sessions.findMany({
    where: eq(sessionsTable.studyId, studyId),
  });
  if (sessRows.length) {
    const sessIds = sessRows.map((s) => s.id);
    const turnRows = await db.query.turns.findMany({
      where: inArray(turnsTable.sessionId, sessIds),
    });
    const turnIds = turnRows.map((t) => t.id);
    if (turnIds.length) {
      await db
        .delete(followUpsTable)
        .where(inArray(followUpsTable.turnId, turnIds));
      await db
        .delete(responsesTable)
        .where(inArray(responsesTable.turnId, turnIds));
    }
    // 2. Synthesis rows reference both turns and sessions; clear before turns/sessions go.
    await db
      .delete(synthesisTable)
      .where(eq(synthesisTable.studyId, studyId));
    if (turnIds.length) {
      await db.delete(turnsTable).where(inArray(turnsTable.id, turnIds));
    }
    await db
      .delete(sessionsTable)
      .where(inArray(sessionsTable.id, sessIds));
  } else {
    await db
      .delete(synthesisTable)
      .where(eq(synthesisTable.studyId, studyId));
  }

  // 3. Plan questions and their attachments — turns are gone, so these are safe.
  if (planQs.length) {
    const qIds = planQs.map((q) => q.id);
    await db
      .delete(questionAttachments)
      .where(inArray(questionAttachments.questionId, qIds));
    await db.delete(planQuestions).where(inArray(planQuestions.id, qIds));
  }
  if (plan) {
    await db.delete(researchPlans).where(eq(researchPlans.id, plan.id));
  }

  // 4. Study-level rows
  await db.delete(reportSections).where(eq(reportSections.studyId, studyId));
  await db.delete(studyArtifacts).where(eq(studyArtifacts.studyId, studyId));
  await db.delete(studies).where(eq(studies.id, studyId));

  return NextResponse.json({ success: true });
}
