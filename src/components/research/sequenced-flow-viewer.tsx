"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Attachment {
  id: string;
  orderIndex: number;
  filename: string;
  path: string;
  label: string | null;
}

interface SequencedFlowViewerProps {
  studyId: string;
  questionId: string;
  attachments: Attachment[];
  onChange: (atts: Attachment[]) => void;
  /** When true, hides editing controls (used in run/report views). */
  readOnly?: boolean;
}

export function SequencedFlowViewer({
  studyId,
  questionId,
  attachments,
  onChange,
  readOnly,
}: SequencedFlowViewerProps) {
  const [busy, setBusy] = useState(false);
  const sorted = [...attachments].sort((a, b) => a.orderIndex - b.orderIndex);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const updated = [...attachments];
      let nextIndex = sorted.length;
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("orderIndex", String(nextIndex));
        const res = await fetch(
          `/api/studies/${studyId}/plan/questions/${questionId}/attachments`,
          { method: "POST", body: fd },
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Upload failed");
        }
        const saved = await res.json();
        updated.push({
          id: saved.id,
          orderIndex: nextIndex,
          filename: saved.filename,
          path: saved.path,
          label: null,
        });
        nextIndex += 1;
      }
      onChange(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(
        `/api/studies/${studyId}/plan/questions/${questionId}/attachments?attachmentId=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      onChange(attachments.filter((a) => a.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border/40 bg-background/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Flow steps ({sorted.length})
        </span>
        {!readOnly && (
          <>
            <Button
              variant="ghost"
              size="xs"
              disabled={busy}
              onClick={() =>
                document
                  .getElementById(`flow-input-${questionId}`)
                  ?.click()
              }
            >
              <Upload className="size-3 mr-1" />
              Add step
            </Button>
            <input
              id={`flow-input-${questionId}`}
              type="file"
              multiple
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No steps yet. Upload screenshots in the order the user would see them.
        </p>
      ) : (
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {sorted.map((a, i) => (
            <li key={a.id} className="relative">
              <Card className="p-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/uploads/${a.path}`}
                  alt={a.label ?? a.filename}
                  className="w-full h-28 object-cover rounded"
                />
                <div className="text-[10px] mt-1 flex items-center justify-between">
                  <span className="font-mono">Step {i + 1}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-rose-400"
                      onClick={() => remove(a.id)}
                      disabled={busy}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
