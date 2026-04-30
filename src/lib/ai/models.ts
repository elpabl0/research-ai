export interface ModelDef {
  id: string;
  name: string;
  provider: "anthropic" | "openai";
  description: string;
  tier: "flagship" | "balanced" | "fast" | "reasoning";
}

export const AVAILABLE_MODELS: ModelDef[] = [
  // ── Anthropic ──────────────────────────────────────────
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    provider: "anthropic",
    description:
      "Latest flagship. Deepest reasoning, 1M-token context window.",
    tier: "flagship",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Best balance of speed, cost, and quality.",
    tier: "balanced",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and inexpensive. Great for high-throughput jobs.",
    tier: "fast",
  },

  // ── OpenAI ─────────────────────────────────────────────
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description:
      "Flagship multimodal model. Strong coding and instruction following.",
    tier: "flagship",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Faster and cheaper with most of the flagship's capability.",
    tier: "balanced",
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Fastest and cheapest OpenAI tier.",
    tier: "fast",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Previous-gen multimodal flagship. Still capable.",
    tier: "balanced",
  },
  {
    id: "o3",
    name: "o3",
    provider: "openai",
    description: "Advanced reasoning model for complex analysis.",
    tier: "reasoning",
  },
  {
    id: "o4-mini",
    name: "o4 Mini",
    provider: "openai",
    description: "Latest reasoning model. Fast and capable.",
    tier: "reasoning",
  },
];

export function getModelsForProvider(
  provider: "anthropic" | "openai"
): ModelDef[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider);
}
