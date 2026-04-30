import { db } from "@/lib/db";
import { studies, researchPlans, planQuestions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  clearStudyError,
  isRunning,
  runStudyInBackground,
} from "@/lib/research-runner";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  if (study.status === "completed") {
    return NextResponse.json({ status: "completed" });
  }
  if (isRunning(studyId)) {
    return NextResponse.json({ status: "already_running" });
  }

  const plan = await db.query.researchPlans.findFirst({
    where: eq(researchPlans.studyId, studyId),
  });
  if (!plan) {
    return NextResponse.json(
      { error: "No plan exists for this study. Generate one first." },
      { status: 400 },
    );
  }
  const questions = await db.query.planQuestions.findMany({
    where: eq(planQuestions.planId, plan.id),
  });
  if (!questions.length) {
    return NextResponse.json(
      { error: "Plan has no questions." },
      { status: 400 },
    );
  }

  await db
    .update(researchPlans)
    .set({ status: "locked" })
    .where(eq(researchPlans.id, plan.id));

  await clearStudyError(studyId);
  runStudyInBackground(studyId);
  return NextResponse.json({ status: "started" });
}
