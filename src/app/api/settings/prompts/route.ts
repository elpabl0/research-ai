import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { DEFAULT_PROMPTS } from "@/config/prompts";

export async function GET() {
  // Load all prompt:: overrides from DB
  const dbRows = await db
    .select()
    .from(settings)
    .where(like(settings.key, "prompt::%"));

  const overrideMap = new Map<string, string>();
  for (const row of dbRows) {
    const promptId = row.key.replace("prompt::", "");
    overrideMap.set(promptId, row.value);
  }

  // Merge defaults with overrides
  const prompts = DEFAULT_PROMPTS.map((def) => {
    const customTemplate = overrideMap.get(def.id);
    return {
      ...def,
      template: customTemplate ?? def.defaultTemplate,
      isCustomized: overrideMap.has(def.id),
    };
  });

  return NextResponse.json(prompts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { id, template } = body as { id: string; template: string };

  if (!id || template === undefined) {
    return NextResponse.json(
      { error: "id and template are required" },
      { status: 400 }
    );
  }

  // Validate that the prompt ID exists in the registry
  const def = DEFAULT_PROMPTS.find((p) => p.id === id);
  if (!def) {
    return NextResponse.json(
      { error: `Unknown prompt ID: ${id}` },
      { status: 400 }
    );
  }

  const dbKey = `prompt::${id}`;

  // Upsert
  const existing = await db.query.settings.findFirst({
    where: eq(settings.key, dbKey),
  });

  if (existing) {
    await db.update(settings).set({ value: template }).where(eq(settings.key, dbKey));
  } else {
    await db.insert(settings).values({ key: dbKey, value: template });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "id query parameter is required" },
      { status: 400 }
    );
  }

  const dbKey = `prompt::${id}`;
  await db.delete(settings).where(eq(settings.key, dbKey));

  return NextResponse.json({ success: true });
}
