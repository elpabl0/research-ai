import { db } from "@/lib/db";
import { studies } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

export async function GET() {
  const all = await db.select().from(studies).orderBy(desc(studies.createdAt));
  return NextResponse.json(all);
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    title,
    problemStatement,
    researchGoals,
    sessionMode,
    selectedPersonaIds,
  } = body as {
    title: string;
    problemStatement: string;
    researchGoals?: string;
    sessionMode?: "one_on_one" | "group";
    selectedPersonaIds?: string[];
  };

  if (!title || !problemStatement) {
    return NextResponse.json(
      { error: "title and problemStatement are required" },
      { status: 400 },
    );
  }

  const id = nanoid();
  await db.insert(studies).values({
    id,
    title,
    problemStatement,
    researchGoals: researchGoals ?? null,
    sessionMode: sessionMode ?? "one_on_one",
    config: JSON.stringify({ selectedPersonaIds: selectedPersonaIds ?? [] }),
    status: "draft",
  });

  return NextResponse.json({ id });
}
