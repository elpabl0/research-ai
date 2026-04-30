"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Eyebrow, Icon } from "@/components/research/primitives";
import { useConfirm } from "@/components/research/confirm-dialog";
import { useListDnd } from "@/lib/dnd/use-list-dnd";

export interface QuestionAttachment {
  id: string;
  orderIndex: number;
  filename: string;
  path: string;
  mimeType: string;
  label: string | null;
}

interface StudyArtefact {
  id: string;
  filename: string;
  kind: "document" | "image";
  path: string;
  mimeType: string;
}

interface Props {
  studyId: string;
  questionId: string;
  attachments: QuestionAttachment[];
  studyArtefacts: StudyArtefact[];
  expectedTurnType: "single" | "sequenced_flow";
  onAttachmentsChange: (next: QuestionAttachment[]) => void;
  onModeChange: (next: "single" | "sequenced_flow") => void;
}

function uploadUrl(path: string) {
  return `/api/uploads/${path}`;
}

export function QuestionAttachmentsEditor({
  studyId,
  questionId,
  attachments,
  studyArtefacts,
  expectedTurnType,
  onAttachmentsChange,
  onModeChange,
}: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const sorted = useMemo(
    () => [...attachments].sort((a, b) => a.orderIndex - b.orderIndex),
    [attachments],
  );

  const attachedPaths = useMemo(
    () => new Set(attachments.map((a) => a.path)),
    [attachments],
  );
  const libraryAvailable = studyArtefacts.filter(
    (a) => a.kind === "image" && !attachedPaths.has(a.path),
  );

  const isSequenced = expectedTurnType === "sequenced_flow";

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const next = [...attachments];
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
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Upload failed");
        }
        const saved = (await res.json()) as {
          id: string;
          filename: string;
          path: string;
          mimeType: string;
          orderIndex: number;
        };
        next.push({
          id: saved.id,
          orderIndex: saved.orderIndex,
          filename: saved.filename,
          path: saved.path,
          mimeType: saved.mimeType,
          label: null,
        });
        nextIndex += 1;
      }
      onAttachmentsChange(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function attachFromLibrary(artefactId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/studies/${studyId}/plan/questions/${questionId}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactId: artefactId,
            orderIndex: sorted.length,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Attach failed");
      }
      const saved = (await res.json()) as {
        id: string;
        filename: string;
        path: string;
        mimeType: string;
        orderIndex: number;
      };
      onAttachmentsChange([
        ...attachments,
        {
          id: saved.id,
          orderIndex: saved.orderIndex,
          filename: saved.filename,
          path: saved.path,
          mimeType: saved.mimeType,
          label: null,
        },
      ]);
      setShowLibrary(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Attach failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(attId: string) {
    const target = attachments.find((a) => a.id === attId);
    const ok = await confirm({
      title: "Remove this asset from the question?",
      body: target ? (
        <>
          <strong style={{ color: "var(--ink)" }}>
            {target.label ?? target.filename}
          </strong>{" "}
          will no longer be shown to personas for this question. The original
          file in study artefacts is unaffected.
        </>
      ) : (
        "This asset will be detached from the question."
      ),
      tone: "danger",
      confirmLabel: "Remove asset",
      icon: "trash-2",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/studies/${studyId}/plan/questions/${questionId}/attachments?attachmentId=${encodeURIComponent(attId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Delete failed");
      }
      const remaining = attachments
        .filter((a) => a.id !== attId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((a, i) => ({ ...a, orderIndex: i }));
      onAttachmentsChange(remaining);
      void persistOrder(remaining);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function persistOrder(next: QuestionAttachment[]) {
    if (next.length === 0) return;
    try {
      await fetch(
        `/api/studies/${studyId}/plan/questions/${questionId}/attachments`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: next.map((a) => ({
              id: a.id,
              orderIndex: a.orderIndex,
            })),
          }),
        },
      );
    } catch {
      /* swallow — local state is the source of truth in the editor */
    }
  }

  function reorderTo(orderedIds: string[]) {
    const byId = new Map(sorted.map((a) => [a.id, a] as const));
    const next = orderedIds
      .map((id, i) => {
        const a = byId.get(id);
        return a ? { ...a, orderIndex: i } : null;
      })
      .filter(Boolean) as QuestionAttachment[];
    if (next.length !== sorted.length) return;
    onAttachmentsChange(next);
    void persistOrder(next);
  }

  const dnd = useListDnd<string>(
    sorted.map((a) => a.id),
    reorderTo,
  );

  async function updateLabel(id: string, label: string) {
    const next = attachments.map((a) =>
      a.id === id ? { ...a, label: label || null } : a,
    );
    onAttachmentsChange(next);
    try {
      await fetch(
        `/api/studies/${studyId}/plan/questions/${questionId}/attachments`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updates: [{ id, label: label || null }],
          }),
        },
      );
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      style={{
        background: "var(--paper-2)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-sm)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <Eyebrow>Assets</Eyebrow>
          <span className="mono" style={{ fontSize: 10 }}>
            {sorted.length}
          </span>
        </div>
        <div
          style={{
            display: "inline-flex",
            padding: 3,
            background: "var(--paper)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r)",
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => onModeChange("single")}
            style={{
              border: 0,
              background: !isSequenced ? "var(--card)" : "transparent",
              color: !isSequenced ? "var(--ink)" : "var(--ink-3)",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 500,
              padding: "5px 10px",
              borderRadius: "calc(var(--r) - 2px)",
              cursor: "pointer",
              boxShadow: !isSequenced
                ? "0 1px 2px rgba(26,24,20,0.06)"
                : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all var(--dur) var(--ease)",
            }}
          >
            <Icon name="grid-2x2" size={12} /> Show all together
          </button>
          <button
            type="button"
            onClick={() => onModeChange("sequenced_flow")}
            style={{
              border: 0,
              background: isSequenced ? "var(--card)" : "transparent",
              color: isSequenced ? "var(--ink)" : "var(--ink-3)",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 500,
              padding: "5px 10px",
              borderRadius: "calc(var(--r) - 2px)",
              cursor: "pointer",
              boxShadow: isSequenced
                ? "0 1px 2px rgba(26,24,20,0.06)"
                : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all var(--dur) var(--ease)",
            }}
          >
            <Icon name="list-ordered" size={12} /> Step-by-step
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--ink-3)",
            lineHeight: 1.5,
          }}
        >
          {isSequenced
            ? "Add screens in the order the persona will see them. Each step gets its own reaction."
            : "Add reference images. The persona sees them all at once when answering."}
        </p>
      ) : (
        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {sorted.map((att, i) => (
            <li
              key={att.id}
              {...dnd.itemProps(att.id)}
              style={{
                position: "relative",
                background: "var(--card)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-sm)",
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                ...dnd.styleFor(att.id),
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4 / 3",
                  borderRadius: 2,
                  overflow: "hidden",
                  background: "var(--paper-2)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadUrl(att.path)}
                  alt={att.label ?? att.filename}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    userSelect: "none",
                  }}
                />
                {isSequenced && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: "var(--ink)",
                      color: "var(--paper)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
              {isSequenced && (
                <input
                  className="input"
                  placeholder="Step label (optional)"
                  value={att.label ?? ""}
                  onChange={(e) => updateLabel(att.id, e.target.value)}
                  style={{
                    fontSize: 11.5,
                    padding: "4px 8px",
                  }}
                />
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    color: "var(--ink-4)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                  title={att.filename}
                >
                  {att.filename}
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button
                    type="button"
                    {...dnd.handleProps(att.id)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: 2,
                      color: "var(--ink-4)",
                      cursor: "grab",
                      touchAction: "none",
                    }}
                    disabled={busy || sorted.length < 2}
                  >
                    <Icon name="grip-vertical" size={11} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: 2,
                      color: "var(--emo-frustrated)",
                    }}
                    onClick={() => remove(att.id)}
                    disabled={busy}
                    aria-label="Remove asset"
                  >
                    <Icon name="x" size={11} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Button
          size="sm"
          variant="secondary"
          icon="upload"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Upload
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="folder-open"
          onClick={() => setShowLibrary((v) => !v)}
          disabled={busy || studyArtefacts.length === 0}
        >
          From study assets
          {libraryAvailable.length > 0 && (
            <span
              className="mono"
              style={{ marginLeft: 4, color: "var(--ink-4)" }}
            >
              {libraryAvailable.length}
            </span>
          )}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={(e) => {
            uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {showLibrary && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-sm)",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Eyebrow>Pick from study assets</Eyebrow>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 2 }}
              onClick={() => setShowLibrary(false)}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
          {libraryAvailable.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--ink-3)",
              }}
            >
              No image artefacts available. Upload some on the right-hand
              Artefacts column or via the Upload button above.
            </p>
          ) : (
            <ol
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(120px, 1fr))",
                gap: 8,
              }}
            >
              {libraryAvailable.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => attachFromLibrary(a.id)}
                    disabled={busy}
                    style={{
                      width: "100%",
                      padding: 4,
                      background: "var(--paper)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--r-sm)",
                      cursor: busy ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      alignItems: "stretch",
                      transition: "all var(--dur) var(--ease)",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 3",
                        borderRadius: 2,
                        overflow: "hidden",
                        background: "var(--paper-2)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uploadUrl(a.path)}
                        alt={a.filename}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        color: "var(--ink-3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={a.filename}
                    >
                      {a.filename}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
