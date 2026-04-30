"use client";

import { create } from "zustand";
import type { SessionMode } from "@/config/research";

interface StudyDraftState {
  title: string;
  problemStatement: string;
  researchGoals: string;
  sessionMode: SessionMode;
  selectedPersonaIds: string[];
  setTitle: (v: string) => void;
  setProblemStatement: (v: string) => void;
  setResearchGoals: (v: string) => void;
  setSessionMode: (v: SessionMode) => void;
  togglePersona: (id: string) => void;
  setSelectedPersonas: (ids: string[]) => void;
  reset: () => void;
}

const initial = {
  title: "",
  problemStatement: "",
  researchGoals: "",
  sessionMode: "one_on_one" as SessionMode,
  selectedPersonaIds: [] as string[],
};

export const useStudyDraftStore = create<StudyDraftState>((set) => ({
  ...initial,
  setTitle: (v) => set({ title: v }),
  setProblemStatement: (v) => set({ problemStatement: v }),
  setResearchGoals: (v) => set({ researchGoals: v }),
  setSessionMode: (v) => set({ sessionMode: v }),
  togglePersona: (id) =>
    set((state) => ({
      selectedPersonaIds: state.selectedPersonaIds.includes(id)
        ? state.selectedPersonaIds.filter((p) => p !== id)
        : [...state.selectedPersonaIds, id],
    })),
  setSelectedPersonas: (ids) => set({ selectedPersonaIds: ids }),
  reset: () => set({ ...initial }),
}));
