import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  generateObject,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ZodType } from "zod";

export type ProviderType = "anthropic" | "openai";

async function getSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, key),
  });
  return row?.value ?? null;
}

export async function getActiveProvider(): Promise<ProviderType> {
  const provider = await getSetting("active_provider");
  return (provider as ProviderType) ?? "anthropic";
}

export async function getActiveModelId(): Promise<string> {
  const model = await getSetting("active_model");
  return model ?? "claude-sonnet-4-6";
}

export async function getModel(): Promise<LanguageModel> {
  const provider = await getActiveProvider();
  const modelId = await getActiveModelId();

  if (provider === "anthropic") {
    const apiKey =
      process.env.ANTHROPIC_API_KEY || (await getSetting("anthropic_api_key"));
    if (!apiKey) {
      throw new Error(
        "Anthropic API key not configured. Go to Settings to add your key.",
      );
    }
    const anthropic = createAnthropic({ apiKey });
    return anthropic(modelId);
  }

  if (provider === "openai") {
    const apiKey =
      process.env.OPENAI_API_KEY || (await getSetting("openai_api_key"));
    if (!apiKey) {
      throw new Error(
        "OpenAI API key not configured. Go to Settings to add your key.",
      );
    }
    const openai = createOpenAI({ apiKey });
    return openai(modelId);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/** Stream a free-text response. */
export async function streamAgentResponse(opts: {
  system: string;
  prompt: string;
  onChunk: (text: string) => void;
  onFinish?: (fullText: string) => void;
}): Promise<string> {
  const model = await getModel();

  const result = streamText({
    model,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  let fullText = "";
  for await (const chunk of (await result).textStream) {
    fullText += chunk;
    opts.onChunk(chunk);
  }

  opts.onFinish?.(fullText);
  return fullText;
}

/**
 * Generate a structured object output using a Zod schema.
 *
 * Either pass a plain `prompt` string or a full `messages` array (used for
 * multimodal calls with image parts). When `messages` is supplied it takes
 * precedence over `prompt`.
 */
export async function generateStructuredOutput<T>(opts: {
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  schema: ZodType<T>;
  onChunk?: (text: string) => void;
}): Promise<{ object: T; text: string }> {
  if (!opts.prompt && !opts.messages) {
    throw new Error("generateStructuredOutput: provide either prompt or messages");
  }

  const model = await getModel();

  const messages: ModelMessage[] =
    opts.messages ??
    [{ role: "user", content: opts.prompt as string } as ModelMessage];

  const result = await generateObject({
    model,
    system: opts.system,
    messages,
    schema: opts.schema,
  });

  const text = structuredToMarkdown(result.object);
  opts.onChunk?.(text);

  return { object: result.object, text };
}

/**
 * Convert a structured output object into human-readable markdown.
 */
export function structuredToMarkdown(obj: unknown, depth: number = 0): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

  if (Array.isArray(obj)) {
    return obj
      .map((item, i) => {
        if (typeof item === "string") return `- ${item}`;
        if (typeof item === "object" && item !== null) {
          const inner = structuredToMarkdown(item, depth + 1);
          return `${i + 1}. ${inner}`;
        }
        return `- ${String(item)}`;
      })
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    return entries
      .map(([key, value]) => {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .replace(/^\w/, (c) => c.toUpperCase())
          .trim();

        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return `**${label}:** ${value}`;
        }
        if (Array.isArray(value)) {
          if (value.length === 0) return `**${label}:** (none)`;
          if (
            value.every((v) => typeof v === "string") &&
            value.join(", ").length < 120
          ) {
            return `**${label}:** ${value.join(", ")}`;
          }
          return `**${label}:**\n${structuredToMarkdown(value, depth + 1)}`;
        }
        if (typeof value === "object" && value !== null) {
          return `**${label}:**\n${structuredToMarkdown(value, depth + 1)}`;
        }
        return `**${label}:** ${String(value)}`;
      })
      .join("\n\n");
  }

  return String(obj);
}
