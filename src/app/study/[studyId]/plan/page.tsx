"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  PlanEditor,
  type QuestionDraft,
} from "@/components/research/plan-editor";
import { toast } from "sonner";
import type { PersonaDef } from "@/config/personas";

interface PlanResponse {
  plan: { id: string; status: string; notes: string | null } | null;
  questions: Array<
    QuestionDraft & {
      attachments: Array<{
        id: string;
        orderIndex: number;
        filename: string;
        path: string;
        label: string | null;
      }>;
    }
  >;
}

export default function PlanEditorPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = use(params);
  const [planRes, setPlanRes] = useState<PlanResponse | null>(null);
  const [personas, setPersonas] = useState<PersonaDef[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [pRes, perRes, studyRes] = await Promise.all([
      fetch(`/api/studies/${studyId}/plan`),
      fetch(`/api/personas`),
      fetch(`/api/studies/${studyId}`),
    ]);
    const planJson = (await pRes.json()) as PlanResponse;
    const allPersonas = (await perRes.json()) as PersonaDef[];
    const studyJson = await studyRes.json();
    const selectedIds: string[] = studyJson.study.config
      ? JSON.parse(studyJson.study.config).selectedPersonaIds ?? []
      : [];
    setPersonas(allPersonas.filter((p) => selectedIds.includes(p.id)));
    setPlanRes(planJson);
  }, [studyId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/plan`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Plan generated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plan generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!planRes) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Research plan
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit, reorder, and lock the plan before running the study.
          </p>
        </div>
        <Link href={`/study/${studyId}`}>
          <Button variant="ghost" size="sm">
            ← Back to study
          </Button>
        </Link>
      </header>

      {!planRes.plan ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No plan exists yet. Generate one from the study inputs.
          </p>
          <Button onClick={generate} disabled={generating}>
            {generating ? "Generating…" : "Generate plan"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={generate}
              disabled={generating}
            >
              {generating ? "Regenerating…" : "Regenerate from inputs"}
            </Button>
          </div>
          <PlanEditor
            studyId={studyId}
            personas={personas}
            initialQuestions={planRes.questions.map((q) => ({
              id: q.id,
              questionText: q.questionText,
              assignedPersonaIds: q.assignedPersonaIds,
              expectedTurnType: q.expectedTurnType,
              notes: q.notes,
              attachments: q.attachments,
            }))}
            initialNotes={planRes.plan.notes ?? ""}
            onSaved={() => load()}
          />
        </>
      )}
    </div>
  );
}
