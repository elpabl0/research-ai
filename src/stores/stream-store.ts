"use client";

import { create } from "zustand";
import type { StreamEvent } from "@/lib/agents/types";

export interface SessionStreamState {
  sessionId: string;
  mode: "one_on_one" | "group";
  participants: Array<{
    id: string;
    name: string;
    avatar: string;
    color: string;
  }>;
  status: "running" | "completed";
  turns: TurnStreamState[];
  synthesis?: {
    personaId: string;
    personaName: string;
    narrative: string;
    topFrustrations: string[];
    topDelights: string[];
    recurringThemes: string[];
    standoutQuotes: Array<{ quote: string; turnOrderIndex?: number }>;
  };
}

export interface TurnStreamState {
  turnId: string;
  orderIndex: number;
  questionText: string;
  expectedTurnType: "single" | "sequenced_flow";
  status: "running" | "completed";
  responses: ResponseStreamState[];
  followUps: Array<{
    followUpId: string;
    parentResponseId: string;
    personaId: string;
    personaName: string;
    question: string;
    rationale: string | null;
    depth: number;
  }>;
  synthesis?: {
    summary: string;
    keyPoints: Array<{ point: string; personaId: string }>;
    surprises: string[];
    openQuestions: string[];
  };
}

export interface ResponseStreamState {
  responseId: string;
  personaId: string;
  personaName: string;
  kind: "initial" | "follow_up";
  questionAsked: string;
  spoken: string;
  sentiment: string;
  painPoints: string[];
  delights: string[];
  confusionPoints: string[];
  stepReactions: Array<{
    stepIndex: number;
    stepLabel?: string;
    reaction: string;
    painPoints: string[];
    delights: string[];
  }> | null;
  overallReaction: string | null;
}

export interface ReportStreamState {
  executiveSummary: string;
  keyFindings: Array<{
    finding: string;
    evidenceStrength: "strong" | "moderate" | "suggestive";
    contributingPersonaIds: string[];
  }>;
  themes: Array<{
    name: string;
    description: string;
    supportingQuotes: Array<{ quote: string; personaId: string }>;
  }>;
  perPersonaFindings: Array<{
    personaId: string;
    personaName: string;
    distinctive: string;
  }>;
  recommendations: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    relatedFindingIndex?: number;
  }>;
  openQuestions: string[];
  sampleCaveat: string;
}

interface StreamStore {
  sessions: Record<string, SessionStreamState>;
  report?: ReportStreamState;
  studyComplete: boolean;
  error?: string;
  apply: (event: StreamEvent) => void;
  reset: () => void;
  /** Bulk-load a persisted transcript (used for completed/interrupted studies). */
  hydrate: (snapshot: {
    sessions: SessionStreamState[];
    report?: ReportStreamState | null;
    studyComplete?: boolean;
  }) => void;
}

export const useStreamStore = create<StreamStore>((set) => ({
  sessions: {},
  report: undefined,
  studyComplete: false,
  error: undefined,
  reset: () =>
    set({ sessions: {}, report: undefined, studyComplete: false, error: undefined }),
  hydrate: ({ sessions, report, studyComplete }) =>
    set({
      sessions: Object.fromEntries(sessions.map((s) => [s.sessionId, s])),
      report: report ?? undefined,
      studyComplete: studyComplete ?? false,
      error: undefined,
    }),
  apply: (event) =>
    set((state) => {
      const sessions = { ...state.sessions };

      function getSession(id: string): SessionStreamState | undefined {
        return sessions[id];
      }
      function updateSession(id: string, mut: (s: SessionStreamState) => void) {
        const s = sessions[id];
        if (!s) return;
        const next = { ...s, turns: [...s.turns] };
        mut(next);
        sessions[id] = next;
      }
      function getTurn(s: SessionStreamState, turnId: string) {
        return s.turns.find((t) => t.turnId === turnId);
      }

      switch (event.type) {
        case "session_start": {
          const data = event.data as {
            sessionId: string;
            mode: "one_on_one" | "group";
            participants: SessionStreamState["participants"];
          };
          sessions[data.sessionId] = {
            sessionId: data.sessionId,
            mode: data.mode,
            participants: data.participants,
            status: "running",
            turns: [],
          };
          break;
        }
        case "turn_start": {
          const data = event.data as {
            turnId: string;
            sessionId: string;
            orderIndex: number;
            questionText: string;
            expectedTurnType: "single" | "sequenced_flow";
          };
          updateSession(data.sessionId, (s) => {
            s.turns.push({
              turnId: data.turnId,
              orderIndex: data.orderIndex,
              questionText: data.questionText,
              expectedTurnType: data.expectedTurnType,
              status: "running",
              responses: [],
              followUps: [],
            });
          });
          break;
        }
        case "response_received": {
          const data = event.data as {
            sessionId?: string;
            turnId: string;
            responseId: string;
            personaId: string;
            personaName: string;
            kind: "initial" | "follow_up";
            questionAsked: string;
            spoken: string;
            sentiment: string;
            painPoints: string[];
            delights: string[];
            confusionPoints: string[];
            stepReactions: ResponseStreamState["stepReactions"];
            overallReaction: string | null;
          };
          for (const sid of Object.keys(sessions)) {
            const session = getSession(sid);
            if (!session) continue;
            const turn = session.turns.find((t) => t.turnId === data.turnId);
            if (!turn) continue;
            updateSession(sid, (s) => {
              const t = getTurn(s, data.turnId);
              if (!t) return;
              t.responses = [
                ...t.responses,
                {
                  responseId: data.responseId,
                  personaId: data.personaId,
                  personaName: data.personaName,
                  kind: data.kind,
                  questionAsked: data.questionAsked,
                  spoken: data.spoken,
                  sentiment: data.sentiment,
                  painPoints: data.painPoints,
                  delights: data.delights,
                  confusionPoints: data.confusionPoints,
                  stepReactions: data.stepReactions,
                  overallReaction: data.overallReaction,
                },
              ];
            });
            break;
          }
          break;
        }
        case "follow_up_asked": {
          const data = event.data as {
            turnId: string;
            followUpId: string;
            parentResponseId: string;
            personaId: string;
            personaName: string;
            question: string;
            rationale: string | null;
            depth: number;
          };
          for (const sid of Object.keys(sessions)) {
            const session = getSession(sid);
            if (!session) continue;
            const turn = session.turns.find((t) => t.turnId === data.turnId);
            if (!turn) continue;
            updateSession(sid, (s) => {
              const t = getTurn(s, data.turnId);
              if (!t) return;
              t.followUps = [
                ...t.followUps,
                {
                  followUpId: data.followUpId,
                  parentResponseId: data.parentResponseId,
                  personaId: data.personaId,
                  personaName: data.personaName,
                  question: data.question,
                  rationale: data.rationale,
                  depth: data.depth,
                },
              ];
            });
            break;
          }
          break;
        }
        case "turn_synthesis": {
          const data = event.data as {
            turnId: string;
            sessionId: string;
            summary: string;
            keyPoints: Array<{ point: string; personaId: string }>;
            surprises: string[];
            openQuestions: string[];
          };
          updateSession(data.sessionId, (s) => {
            const t = getTurn(s, data.turnId);
            if (!t) return;
            t.status = "completed";
            t.synthesis = {
              summary: data.summary,
              keyPoints: data.keyPoints,
              surprises: data.surprises,
              openQuestions: data.openQuestions,
            };
          });
          break;
        }
        case "session_synthesis": {
          const data = event.data as {
            sessionId: string;
            personaId: string;
            personaName: string;
            narrative: string;
            topFrustrations: string[];
            topDelights: string[];
            recurringThemes: string[];
            standoutQuotes: Array<{ quote: string; turnOrderIndex?: number }>;
          };
          updateSession(data.sessionId, (s) => {
            s.synthesis = {
              personaId: data.personaId,
              personaName: data.personaName,
              narrative: data.narrative,
              topFrustrations: data.topFrustrations,
              topDelights: data.topDelights,
              recurringThemes: data.recurringThemes,
              standoutQuotes: data.standoutQuotes,
            };
          });
          break;
        }
        case "session_complete": {
          const data = event.data as { sessionId: string };
          updateSession(data.sessionId, (s) => {
            s.status = "completed";
          });
          break;
        }
        case "report_generated": {
          const data = event.data as unknown as ReportStreamState;
          return { ...state, report: data, sessions };
        }
        case "study_complete": {
          return { ...state, sessions, studyComplete: true };
        }
        case "error": {
          const data = event.data as { message: string };
          return { ...state, sessions, error: data.message };
        }
      }

      return { ...state, sessions };
    }),
}));
