"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PersonaDef } from "@/config/personas";
import { SequencedFlowViewer } from "./sequenced-flow-viewer";

interface QuestionAttachment {
  id: string;
  orderIndex: number;
  filename: string;
  path: string;
  label: string | null;
}

export interface QuestionDraft {
  id?: string;
  questionText: string;
  assignedPersonaIds: string[];
  expectedTurnType: "single" | "sequenced_flow";
  notes?: string;
  attachments?: QuestionAttachment[];
}

interface PlanEditorProps {
  studyId: string;
  personas: PersonaDef[];
  initialQuestions: QuestionDraft[];
  initialNotes?: string;
  onSaved: () => void;
}

export function PlanEditor({
  studyId,
  personas,
  initialQuestions,
  initialNotes,
  onSaved,
}: PlanEditorProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialQuestions.map((q) => ({ ...q })),
  );
  const [saving, setSaving] = useState(false);

  const update = (idx: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const remove = (idx: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== idx));

  const add = () =>
    setQuestions((prev) => [
      ...prev,
      {
        questionText: "",
        assignedPersonaIds: personas.map((p) => p.id),
        expectedTurnType: "single",
        attachments: [],
      },
    ]);

  const togglePersona = (idx: number, personaId: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const ids = next[idx].assignedPersonaIds;
      next[idx] = {
        ...next[idx],
        assignedPersonaIds: ids.includes(personaId)
          ? ids.filter((p) => p !== personaId)
          : [...ids, personaId],
      };
      return next;
    });
  };

  const save = async (statusAfter: "draft" | "edited" | "locked") => {
    if (questions.some((q) => !q.questionText.trim())) {
      toast.error("Each question needs text.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          status: statusAfter,
          questions: questions.map((q) => ({
            id: q.id,
            questionText: q.questionText,
            assignedPersonaIds: q.assignedPersonaIds,
            expectedTurnType: q.expectedTurnType,
            notes: q.notes,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      toast.success(statusAfter === "locked" ? "Plan locked" : "Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/80 border-border/60">
        <label className="text-sm font-medium mb-2 block">Plan summary</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What this plan will reveal."
        />
      </Card>

      <div className="space-y-3">
        {questions.map((q, idx) => (
          <Card
            key={q.id ?? `new-${idx}`}
            className="p-4 bg-card/80 border-border/60 space-y-3"
          >
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs text-muted-foreground mt-2">
                Q{idx + 1}
              </span>
              <Textarea
                value={q.questionText}
                onChange={(e) => update(idx, { questionText: e.target.value })}
                rows={2}
                className="flex-1"
                placeholder="Open, neutral, non-leading interview question…"
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="size-3" />
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => move(idx, 1)}
                  disabled={idx === questions.length - 1}
                >
                  <ChevronDown className="size-3" />
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => remove(idx)}
                  className="text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Ask
              </span>
              {personas.map((p) => {
                const active = q.assignedPersonaIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePersona(idx, p.id)}
                    className={[
                      "px-2 py-0.5 rounded-md text-[11px] border transition-colors",
                      active
                        ? "bg-[#6366F1]/15 border-[#6366F1]/60 text-foreground"
                        : "bg-background/40 border-border/40 text-muted-foreground",
                    ].join(" ")}
                  >
                    {p.avatar} {p.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                {q.expectedTurnType === "sequenced_flow"
                  ? "Sequenced flow walkthrough"
                  : "Single question"}
              </Badge>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  update(idx, {
                    expectedTurnType:
                      q.expectedTurnType === "single"
                        ? "sequenced_flow"
                        : "single",
                  })
                }
              >
                Switch
              </Button>
            </div>

            {q.id && q.expectedTurnType === "sequenced_flow" && (
              <SequencedFlowViewer
                studyId={studyId}
                questionId={q.id}
                attachments={q.attachments ?? []}
                onChange={(atts) => update(idx, { attachments: atts })}
              />
            )}

            {q.id && q.expectedTurnType === "single" && (
              <SequencedFlowViewer
                studyId={studyId}
                questionId={q.id}
                attachments={q.attachments ?? []}
                onChange={(atts) => update(idx, { attachments: atts })}
              />
            )}

            {q.notes && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-border/40 pl-2">
                {q.notes}
              </p>
            )}
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="size-3.5 mr-1" />
          Add question
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => save("edited")}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button size="sm" onClick={() => save("locked")} disabled={saving}>
          Lock plan
        </Button>
      </div>
    </div>
  );
}
