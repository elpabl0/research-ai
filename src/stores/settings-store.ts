import { create } from "zustand";

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  activeProvider: "anthropic" | "openai";
  activeModel: string;
  isLoaded: boolean;

  setAnthropicKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setActiveProvider: (provider: "anthropic" | "openai") => void;
  setActiveModel: (model: string) => void;
  loadSettings: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  anthropicKey: "",
  openaiKey: "",
  activeProvider: "anthropic",
  activeModel: "claude-sonnet-4-6",
  isLoaded: false,

  setAnthropicKey: (key) => set({ anthropicKey: key }),
  setOpenaiKey: (key) => set({ openaiKey: key }),
  setActiveProvider: (provider) => set({ activeProvider: provider }),
  setActiveModel: (model) => set({ activeModel: model }),

  loadSettings: async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    set({
      anthropicKey: data.anthropic_api_key || "",
      openaiKey: data.openai_api_key || "",
      activeProvider: data.active_provider || "anthropic",
      activeModel: data.active_model || "claude-sonnet-4-6",
      isLoaded: true,
    });
  },

  saveSetting: async (key, value) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  },
}));
