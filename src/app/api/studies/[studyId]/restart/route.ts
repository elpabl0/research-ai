import { db } from "@/lib/db";
import {
  studies,
  sessions as sessionsTable,
  turns as turnsTable,
  responses as responsesTable,
  followUps as followUpsTable,
  synthesis as synthesisTable,
  reportSections,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { clearStudyError, runStudyInBackground } from "@/lib/research-runner";
import { NextResponse } from "next/server";

/** POST resets all run artefacts and starts the study again from scratch. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;

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
      await db.delete(followUpsTable).where(inArray(followUpsTable.turnId, turnIds));
      await db.delete(responsesTable).where(inArray(responsesTable.turnId, turnIds));
      await db.delete(turnsTable).where(inArray(turnsTable.id, turnIds));
    }
    await db.delete(sessionsTable).where(inArray(sessionsTable.id, sessIds));
  }
  await db.delete(synthesisTable).where(eq(synthesisTable.studyId, studyId));
  await db.delete(reportSections).where(eq(reportSections.studyId, studyId));

  await db
    .update(studies)
    .set({ status: "plan_ready", updatedAt: new Date() })
    .where(eq(studies.id, studyId));

  await clearStudyError(studyId);
  runStudyInBackground(studyId);
  return NextResponse.json({ status: "restarted" });
}
