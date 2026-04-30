import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const allSettings = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const s of allSettings) {
    // Mask API keys for client display
    if (s.key.endsWith("_api_key") && s.value) {
      map[s.key] = s.value.slice(0, 8) + "..." + s.value.slice(-4);
    } else {
      map[s.key] = s.value;
    }
  }

  // Override with server-configured indicator when env var keys are set
  if (process.env.ANTHROPIC_API_KEY) {
    map["anthropic_api_key"] = "server-configured";
  }
  if (process.env.OPENAI_API_KEY) {
    map["openai_api_key"] = "server-configured";
  }

  return NextResponse.json(map);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { key, value } = body as { key: string; value: string };

  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 }
    );
  }

  // Upsert the setting
  const existing = await db.query.settings.findFirst({
    where: eq(settings.key, key),
  });

  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }

  return NextResponse.json({ success: true });
}
