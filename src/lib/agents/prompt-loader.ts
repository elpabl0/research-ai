import { db } from "@/lib/db";
import { personas as personasTable, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_PROMPTS } from "@/config/prompts";
import { PERSONAS, type PersonaDef } from "@/config/personas";

/**
 * Load a prompt template, preferring DB override over default.
 * Replaces {{variables}} with provided values.
 */
export async function loadPrompt(
  promptId: string,
  variables: Record<string, string> = {},
): Promise<string> {
  const dbKey = `prompt::${promptId}`;
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, dbKey),
  });

  let template: string;
  if (row?.value) {
    template = row.value;
  } else {
    const def = DEFAULT_PROMPTS.find((p) => p.id === promptId);
    template = def?.defaultTemplate ?? "";
  }

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }

  return template;
}

export async function loadPromptTemplate(promptId: string): Promise<string> {
  const dbKey = `prompt::${promptId}`;
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, dbKey),
  });

  if (row?.value) return row.value;

  const def = DEFAULT_PROMPTS.find((p) => p.id === promptId);
  return def?.defaultTemplate ?? "";
}

function rowToPersona(row: typeof personasTable.$inferSelect): PersonaDef {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    color: row.color,
    description: row.systemPromptFragment.slice(0, 140),
    demographics: row.demographics ? JSON.parse(row.demographics) : {},
    goals: row.goals ? JSON.parse(row.goals) : [],
    painPoints: row.painPoints ? JSON.parse(row.painPoints) : [],
    techComfort: row.techComfort,
    behaviouralTraits: row.behaviouralTraits
      ? JSON.parse(row.behaviouralTraits)
      : [],
    communicationStyle: row.communicationStyle ?? "",
    systemPromptFragment: row.systemPromptFragment,
    isPreset: row.isPreset,
  };
}

/**
 * Load a single persona by id. Looks first in the custom DB table; falls
 * back to the bundled preset list. Returns null if neither exists.
 */
export async function loadPersona(personaId: string): Promise<PersonaDef | null> {
  const row = await db.query.personas.findFirst({
    where: eq(personasTable.id, personaId),
  });
  if (row) return rowToPersona(row);

  return PERSONAS.find((p) => p.id === personaId) ?? null;
}

/**
 * Load the merged persona library: presets + any DB-stored custom personas.
 * Custom records that share an id with a preset override the preset.
 */
export async function loadAllPersonas(): Promise<PersonaDef[]> {
  const customRows = await db.query.personas.findMany();
  const customById = new Map(customRows.map((row) => [row.id, rowToPersona(row)]));

  const merged: PersonaDef[] = [];
  for (const preset of PERSONAS) {
    merged.push(customById.get(preset.id) ?? preset);
  }

  for (const [id, persona] of customById.entries()) {
    if (!PERSONAS.some((p) => p.id === id)) merged.push(persona);
  }

  return merged;
}

/** Format a persona's structured fields into prompt-ready blocks. */
export function formatPersonaBlocks(persona: PersonaDef) {
  const demoEntries = Object.entries(persona.demographics).filter(
    ([, value]) => value && String(value).trim() !== "",
  );
  const demographicsBlock = demoEntries.length
    ? demoEntries
        .map(([k, v]) => `- ${labelise(k)}: ${v}`)
        .join("\n")
    : "(no specific demographics)";

  const goalsBlock = persona.goals.length
    ? persona.goals.map((g) => `- ${g}`).join("\n")
    : "(none recorded)";
  const painPointsBlock = persona.painPoints.length
    ? persona.painPoints.map((p) => `- ${p}`).join("\n")
    : "(none recorded)";
  const behaviouralTraitsBlock = persona.behaviouralTraits.length
    ? persona.behaviouralTraits.map((t) => `- ${t}`).join("\n")
    : "(none recorded)";

  return {
    personaName: persona.name,
    personaDescription: persona.description,
    demographicsBlock,
    goalsBlock,
    painPointsBlock,
    behaviouralTraitsBlock,
    techComfort: persona.techComfort,
    communicationStyle: persona.communicationStyle,
    systemPromptFragment: persona.systemPromptFragment,
  };
}

function labelise(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
