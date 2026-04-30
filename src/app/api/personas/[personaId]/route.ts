import { db } from "@/lib/db";
import { personas as personasTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { loadPersona } from "@/lib/agents/prompt-loader";
import type { PersonaDef } from "@/config/personas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> },
) {
  const { personaId } = await params;
  const persona = await loadPersona(personaId);
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  return NextResponse.json(persona);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ personaId: string }> },
) {
  const { personaId } = await params;
  const body = (await request.json()) as Partial<PersonaDef>;

  const existingRow = await db.query.personas.findFirst({
    where: eq(personasTable.id, personaId),
  });

  // Build the row payload, falling back to current values for fields not supplied.
  const current = existingRow
    ? {
        name: existingRow.name,
        avatar: existingRow.avatar,
        color: existingRow.color,
        demographics: existingRow.demographics,
        goals: existingRow.goals,
        painPoints: existingRow.painPoints,
        techComfort: existingRow.techComfort,
        behaviouralTraits: existingRow.behaviouralTraits,
        communicationStyle: existingRow.communicationStyle,
        systemPromptFragment: existingRow.systemPromptFragment,
        isPreset: existingRow.isPreset,
      }
    : await loadPersona(personaId);

  if (!current) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  const merged = {
    name: body.name ?? (current as { name: string }).name,
    avatar: body.avatar ?? (current as { avatar: string }).avatar,
    color: body.color ?? (current as { color: string }).color,
    demographics: JSON.stringify(
      body.demographics ??
        ("demographics" in current && typeof current.demographics === "object"
          ? current.demographics
          : current.demographics
            ? JSON.parse(current.demographics as string)
            : {}),
    ),
    goals: JSON.stringify(
      body.goals ??
        (Array.isArray((current as { goals: unknown }).goals)
          ? (current as { goals: string[] }).goals
          : current.goals
            ? JSON.parse(current.goals as unknown as string)
            : []),
    ),
    painPoints: JSON.stringify(
      body.painPoints ??
        (Array.isArray((current as { painPoints: unknown }).painPoints)
          ? (current as { painPoints: string[] }).painPoints
          : current.painPoints
            ? JSON.parse(current.painPoints as unknown as string)
            : []),
    ),
    techComfort:
      body.techComfort ?? (current as { techComfort: "low" | "medium" | "high" }).techComfort,
    behaviouralTraits: JSON.stringify(
      body.behaviouralTraits ??
        (Array.isArray((current as { behaviouralTraits: unknown }).behaviouralTraits)
          ? (current as { behaviouralTraits: string[] }).behaviouralTraits
          : current.behaviouralTraits
            ? JSON.parse(current.behaviouralTraits as unknown as string)
            : []),
    ),
    communicationStyle:
      body.communicationStyle ??
      (current as { communicationStyle: string }).communicationStyle,
    systemPromptFragment:
      body.systemPromptFragment ??
      (current as { systemPromptFragment: string }).systemPromptFragment,
    isPreset: false, // any edit creates a custom override
  };

  if (existingRow) {
    await db
      .update(personasTable)
      .set(merged)
      .where(eq(personasTable.id, personaId));
  } else {
    await db.insert(personasTable).values({ id: personaId, ...merged });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> },
) {
  const { personaId } = await params;
  const existing = await db.query.personas.findFirst({
    where: eq(personasTable.id, personaId),
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Cannot delete a preset persona. Edits revert via DB delete." },
      { status: 400 },
    );
  }
  await db.delete(personasTable).where(eq(personasTable.id, personaId));
  return NextResponse.json({ success: true });
}
