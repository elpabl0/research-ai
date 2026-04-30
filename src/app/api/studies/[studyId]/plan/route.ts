import { db } from "@/lib/db";
import {
  studies,
  studyArtifacts,
  researchPlans,
  planQuestions,
  questionAttachments,
} from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { generateResearchPlan } from "@/lib/agents/researcher";
import { loadPersona } from "@/lib/agents/prompt-loader";
import type { PersonaDef } from "@/config/personas";
import type { StudyContext } from "@/lib/agents/types";

async function buildStudyContextLite(studyId: string): Promise<StudyContext> {
  const study = await db.query.studies.findFirst({
    where: eq(studies.id, studyId),
  });
  if (!study) throw new Error("Study not found");
  const artifacts = await db.query.studyArtifacts.findMany({
    where: eq(studyArtifacts.studyId, studyId),
  });
  const supportingData = artifacts
    .filter((a) => a.kind === "document" && a.extractedText)
    .map((a) => `### ${a.filename}\n${a.extractedText}`)
    .join("\n\n");
  const artifactSummary = artifacts.length
    ? artifacts.map((a) => `- ${a.kind}: ${a.filename}`).join("\n")
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
  if (!study) throw new Error("Study not found");
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;
  const plan = await db.query.researchPlans.findFirst({
    where: eq(researchPlans.studyId, studyId),
  });
  if (!plan) return NextResponse.json({ plan: null, questions: [] });

  const questions = await db.query.planQuestions.findMany({
    where: eq(planQuestions.planId, plan.id),
    orderBy: [asc(planQuestions.orderIndex)],
  });

  const enriched = await Promise.all(
    questions.map(async (q) => {
      const atts = await db.query.questionAttachments.findMany({
        where: eq(questionAttachments.questionId, q.id),
        orderBy: [asc(questionAttachments.orderIndex)],
      });
      return {
        ...q,
        assignedPersonaIds: JSON.parse(q.assignedPersonaIds),
        attachments: atts,
      };
    }),
  );

  return NextResponse.json({ plan, questions: enriched });
}

/** POST = generate (or regenerate) the plan. */
export async function POST(
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

  const ctx = await buildStudyContextLite(studyId);
  const personas = await loadSelectedPersonas(studyId);
  if (!personas.length) {
    return NextResponse.json(
      { error: "Select at least one persona before generating a plan." },
      { status: 400 },
    );
  }

  const artifacts = await db.query.studyArtifacts.findMany({
    where: eq(studyArtifacts.studyId, studyId),
  });
  const hasFlowArtifacts = artifacts.some((a) => a.kind === "image");

  await db
    .update(studies)
    .set({ status: "planning", updatedAt: new Date() })
    .where(eq(studies.id, studyId));

  let planObj;
  try {
    planObj = await generateResearchPlan({
      study: ctx,
      selectedPersonas: personas,
      hasFlowArtifacts,
    });
  } catch (e) {
    // Reset the study so it doesn't stay stuck in "planning".
    const previousStatus = study.status === "planning" ? "draft" : study.status;
    await db
      .update(studies)
      .set({ status: previousStatus, updatedAt: new Date() })
      .where(eq(studies.id, studyId));
    const message = e instanceof Error ? e.message : "Plan generation failed";
    const status = message.includes("API key") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  // Wipe any existing plan + questions for this study.
  const existing = await db.query.researchPlans.findFirst({
    where: eq(researchPlans.studyId, studyId),
  });
  if (existing) {
    const oldQs = await db.query.planQuestions.findMany({
      where: eq(planQuestions.planId, existing.id),
    });
    if (oldQs.length) {
      const oldIds = oldQs.map((q) => q.id);
      await db
        .delete(questionAttachments)
        .where(inArray(questionAttachments.questionId, oldIds));
      await db.delete(planQuestions).where(inArray(planQuestions.id, oldIds));
    }
    await db.delete(researchPlans).where(eq(researchPlans.id, existing.id));
  }

  const planId = nanoid(10);
  await db.insert(researchPlans).values({
    id: planId,
    studyId,
    status: "draft",
    notes: planObj.summary,
  });

  for (let i = 0; i < planObj.questions.length; i++) {
    const q = planObj.questions[i];
    await db.insert(planQuestions).values({
      id: nanoid(10),
      planId,
      orderIndex: i,
      questionText: q.questionText,
      assignedPersonaIds: JSON.stringify(
        q.suggestedPersonaIds.length
          ? q.suggestedPersonaIds
          : personas.map((p) => p.id),
      ),
      expectedTurnType: q.expectedTurnType,
      notes: q.rationale,
    });
  }

  await db
    .update(studies)
    .set({ status: "plan_ready", updatedAt: new Date() })
    .where(eq(studies.id, studyId));

  return NextResponse.json({ planId, summary: planObj.summary });
}

/** PATCH = replace the plan's questions in one transaction. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;
  const body = (await request.json()) as {
    notes?: string;
    questions?: Array<{
      id?: string;
      questionText: string;
      assignedPersonaIds: string[];
      expectedTurnType: "single" | "sequenced_flow";
      notes?: string;
    }>;
    status?: "draft" | "edited" | "locked";
  };

  const plan = await db.query.researchPlans.findFirst({
    where: eq(researchPlans.studyId, studyId),
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (body.notes !== undefined || body.status !== undefined) {
    await db
      .update(researchPlans)
      .set({
        notes: body.notes ?? plan.notes,
        status: body.status ?? plan.status,
      })
      .where(eq(researchPlans.id, plan.id));
  }

  if (body.questions) {
    // Wipe and reinsert (preserving attachments by id where possible).
    const existing = await db.query.planQuestions.findMany({
      where: eq(planQuestions.planId, plan.id),
    });
    const existingIds = new Set(existing.map((q) => q.id));
    const incomingIds = new Set(
      body.questions.map((q) => q.id).filter(Boolean) as string[],
    );

    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (toDelete.length) {
      await db
        .delete(questionAttachments)
        .where(inArray(questionAttachments.questionId, toDelete));
      await db
        .delete(planQuestions)
        .where(inArray(planQuestions.id, toDelete));
    }

    for (let i = 0; i < body.questions.length; i++) {
      const q = body.questions[i];
      if (q.id && existingIds.has(q.id)) {
        await db
          .update(planQuestions)
          .set({
            orderIndex: i,
            questionText: q.questionText,
            assignedPersonaIds: JSON.stringify(q.assignedPersonaIds),
            expectedTurnType: q.expectedTurnType,
            notes: q.notes ?? null,
          })
          .where(eq(planQuestions.id, q.id));
      } else {
        await db.insert(planQuestions).values({
          id: nanoid(10),
          planId: plan.id,
          orderIndex: i,
          questionText: q.questionText,
          assignedPersonaIds: JSON.stringify(q.assignedPersonaIds),
          expectedTurnType: q.expectedTurnType,
          notes: q.notes ?? null,
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
