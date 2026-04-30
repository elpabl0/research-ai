import { db } from "@/lib/db";
import { reportSections } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await params;
  const rows = await db.query.reportSections.findMany({
    where: eq(reportSections.studyId, studyId),
    orderBy: [asc(reportSections.orderIndex)],
  });
  return NextResponse.json(rows);
}
