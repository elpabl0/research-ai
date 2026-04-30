import { db } from "@/lib/db";
import { personas as personasTable } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { loadAllPersonas } from "@/lib/agents/prompt-loader";
import type { PersonaDef } from "@/config/personas";

export async function GET() {
  const merged = await loadAllPersonas();
  return NextResponse.json(merged);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<PersonaDef>;
  if (!body.name || !body.systemPromptFragment) {
    return NextResponse.json(
      { error: "name and systemPromptFragment are required" },
      { status: 400 },
    );
  }
  const id = body.id ?? `custom-${nanoid(8)}`;

  await db.insert(personasTable).values({
    id,
    name: body.name,
    avatar: body.avatar ?? "👤",
    color: body.color ?? "#6366F1",
    demographics: JSON.stringify(body.demographics ?? {}),
    goals: JSON.stringify(body.goals ?? []),
    painPoints: JSON.stringify(body.painPoints ?? []),
    techComfort: body.techComfort ?? "medium",
    behaviouralTraits: JSON.stringify(body.behaviouralTraits ?? []),
    communicationStyle: body.communicationStyle ?? "",
    systemPromptFragment: body.systemPromptFragment,
    isPreset: false,
  });
  return NextResponse.json({ id });
}
