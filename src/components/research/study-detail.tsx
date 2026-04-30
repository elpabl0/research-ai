"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Eyebrow,
  Icon,
  SectionHeader,
  StatusPill,
  TechBadge,
  type PersonaVisual,
  personaShortName,
  personaTech,
  personaTitle,
} from "@/components/research/primitives";
import { useStudyDraftStore } from "@/stores/study-store";
import { ArtefactPreviewModal } from "@/components/research/artefact-preview-modal";
import {
  QuestionAttachmentsEditor,
  type QuestionAttachment,
} from "@/components/research/question-attachments-editor";
import { useConfirm } from "@/components/research/confirm-dialog";
import { useListDnd } from "@/lib/dnd/use-list-dnd";
import type { PersonaDef } from "@/config/personas";

interface QuestionRow {
  id: string;
  questionText: string;
  expectedTurnType: "single" | "sequenced_flow";
  assignedPersonaIds: string[];
  notes?: string | null;
  attachments?: QuestionAttachment[];
}

interface ArtifactRow {
  id: string;
  filename: string;
  kind: "document" | "image";
  path: string;
  mimeType: string;
}

interface StudyDetailData {
  study: {
    id: string;
    title: string;
    problemStatement: string;
    researchGoals: string | null;
    status: string;
    sessionMode: "one_on_one" | "group";
    config: string | null;
  };
  artifacts: ArtifactRow[];
  plan: { id: string; status: string; notes: string | null } | null;
  questions: QuestionRow[];
  sessions: Array<{ id: string; status: string }>;
  reportSections: Array<{ id: string }>;
}

type EditableQuestion = QuestionRow & { _local?: boolean };

function PlanEmpty({
  onGenerate,
  hasArtefacts,
  busy,
}: {
  onGenerate: () => void;
  hasArtefacts: boolean;
  busy: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 32,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: "var(--paper-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-2)",
        }}
      >
        <Icon name="sparkles" size={20} />
      </span>
      <div
        className="serif"
        style={{ fontSize: 21, color: "var(--ink)", maxWidth: 320 }}
      >
        Generate a question plan from your brief.
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-3)",
          lineHeight: 1.5,
          maxWidth: 360,
          margin: 0,
        }}
      >
        We&apos;ll draft 5–8 questions covering open prompts and screen
        walkthroughs. You can edit, reorder, or remove anything before going
        live.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Button
          variant="primary"
          icon="sparkles"
          onClick={onGenerate}
          disabled={busy}
        >
          {busy ? "Drafting…" : "Generate plan"}
        </Button>
      </div>
      {!hasArtefacts && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--ink-4)",
            marginTop: 6,
          }}
        >
          tip · upload screens for walkthrough questions
        </span>
      )}
    </div>
  );
}

function PlanGenerating() {
  return (
    <div
      className="card"
      style={{
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            border: "2px solid var(--rule)",
            borderTopColor: "var(--ink)",
            animation: "spin 0.8s linear infinite",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 13.5, color: "var(--ink)" }}>
          Drafting questions from your brief…
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 8,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="shimmer-bar"
            style={{
              height: 14,
              borderRadius: 4,
              animationDelay: `${i * 0.1}s`,
              width: `${85 - i * 5}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface RowDndProps {
  rowProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  rowStyle?: React.CSSProperties;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

function DragHandle({
  handleProps,
  disabled,
}: {
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      {...handleProps}
      disabled={disabled}
      className="btn btn-ghost btn-sm"
      style={{
        padding: 4,
        cursor: disabled ? "not-allowed" : "grab",
        color: "var(--ink-4)",
        ...((handleProps?.style as React.CSSProperties) ?? {}),
      }}
    >
      <Icon name="grip-vertical" size={14} />
    </button>
  );
}

function QuestionRowView({
  q,
  index,
  totalPersonas,
  personasById,
  onEdit,
  onRemove,
  canEdit,
  dnd,
  canReorder,
}: {
  q: QuestionRow;
  index: number;
  totalPersonas: number;
  personasById: Record<string, PersonaDef>;
  onEdit: () => void;
  onRemove?: () => void;
  canEdit: boolean;
  dnd?: RowDndProps;
  canReorder?: boolean;
}) {
  const personas = (q.assignedPersonaIds ?? [])
    .map((id) => personasById[id])
    .filter(Boolean) as PersonaDef[];
  return (
    <div
      {...(dnd?.rowProps ?? {})}
      className="card"
      style={{
        padding: "14px 16px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        ...(dnd?.rowStyle ?? {}),
      }}
    >
      {canReorder ? (
        <DragHandle handleProps={dnd?.handleProps} />
      ) : null}
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--r)",
          background: "var(--paper-2)",
          color: "var(--ink-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        Q{index + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          {q.expectedTurnType === "sequenced_flow" ? (
            <span className="pill">
              <Icon name="list-ordered" size={11} /> step-by-step
            </span>
          ) : q.attachments && q.attachments.length > 0 ? (
            <span className="pill">
              <Icon name="grid-2x2" size={11} /> with assets
            </span>
          ) : (
            <span className="pill">
              <Icon name="message-circle" size={11} /> open
            </span>
          )}
          {q.attachments && q.attachments.length > 0 && (
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-4)" }}
            >
              {q.attachments.length} asset
              {q.attachments.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--ink)",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {q.questionText}
        </div>
        {q.attachments && q.attachments.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            {[...q.attachments]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((att, attIndex) => (
                <span
                  key={att.id}
                  title={att.label ?? att.filename}
                  style={{
                    position: "relative",
                    width: 48,
                    height: 36,
                    borderRadius: 3,
                    border: "1px solid var(--rule)",
                    overflow: "hidden",
                    background: "var(--paper-2)",
                    flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/uploads/${att.path}`}
                    alt={att.label ?? att.filename}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {q.expectedTurnType === "sequenced_flow" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 1,
                        left: 1,
                        background: "var(--ink)",
                        color: "var(--paper)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 8,
                        padding: "1px 3px",
                        borderRadius: 2,
                        lineHeight: 1,
                      }}
                    >
                      {attIndex + 1}
                    </span>
                  )}
                </span>
              ))}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          <span className="mono" style={{ fontSize: 10 }}>
            asked of
          </span>
          {personas.map((p) => (
            <span
              key={p.id}
              title={personaShortName(p as unknown as PersonaVisual)}
            >
              <Avatar
                persona={p as unknown as PersonaVisual}
                size={20}
                withGlyph={false}
              />
            </span>
          ))}
          {personas.length < totalPersonas && (
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-4)" }}
            >
              · {personas.length} of {totalPersonas}
            </span>
          )}
        </div>
      </div>
      {canEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: 6 }}
            onClick={onEdit}
            title="Edit question"
            aria-label="Edit question"
          >
            <Icon name="edit-3" size={13} />
          </button>
          {onRemove && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 6, color: "var(--emo-frustrated)" }}
              onClick={onRemove}
              title="Delete question"
              aria-label="Delete question"
            >
              <Icon name="trash-2" size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionRowEdit({
  draft,
  index,
  studyId,
  selectedPersonas,
  studyArtefacts,
  onChange,
  onCancel,
  onCommit,
  dnd,
}: {
  draft: EditableQuestion;
  index: number;
  studyId: string;
  selectedPersonas: PersonaDef[];
  studyArtefacts: ArtifactRow[];
  onChange: (patch: Partial<EditableQuestion>) => void;
  onCancel: () => void;
  onCommit: () => void;
  dnd?: RowDndProps;
}) {
  const togglePersona = (id: string) => {
    const ids = draft.assignedPersonaIds.includes(id)
      ? draft.assignedPersonaIds.filter((p) => p !== id)
      : [...draft.assignedPersonaIds, id];
    onChange({ assignedPersonaIds: ids });
  };
  return (
    <div
      {...(dnd?.rowProps ?? {})}
      className="card"
      style={{
        padding: 16,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        borderColor: "var(--ink)",
        boxShadow: "0 0 0 2px rgba(26,24,20,0.08)",
        ...(dnd?.rowStyle ?? {}),
      }}
    >
      <DragHandle handleProps={dnd?.handleProps} />
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--r)",
          background: "var(--ink)",
          color: "var(--paper)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        Q{index + 1}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <textarea
          className="textarea"
          rows={3}
          value={draft.questionText}
          placeholder="Open, neutral, non-leading interview question…"
          onChange={(e) =>
            onChange({ questionText: e.target.value })
          }
          style={{ fontSize: 14, lineHeight: 1.5 }}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span className="mono" style={{ fontSize: 10 }}>
            asked of
          </span>
          {selectedPersonas.map((p) => {
            const active = draft.assignedPersonaIds.includes(p.id);
            const visual = p as unknown as PersonaVisual;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePersona(p.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px 3px 3px",
                  background: active ? "var(--ink)" : "var(--paper-2)",
                  color: active ? "var(--paper)" : "var(--ink-2)",
                  border: `1px solid ${
                    active ? "var(--ink)" : "var(--rule)"
                  }`,
                  borderRadius: 999,
                  cursor: "pointer",
                  transition: "all var(--dur) var(--ease)",
                  fontSize: 12,
                }}
                title={p.name}
              >
                <Avatar persona={visual} size={18} withGlyph={false} />
                {personaShortName(visual)}
              </button>
            );
          })}
        </div>
        {draft._local ? (
          <div
            style={{
              padding: "10px 12px",
              border: "1px dashed var(--rule)",
              borderRadius: "var(--r-sm)",
              fontSize: 12,
              color: "var(--ink-3)",
              lineHeight: 1.5,
            }}
          >
            Save the plan to start attaching assets to this question.
          </div>
        ) : (
          <QuestionAttachmentsEditor
            studyId={studyId}
            questionId={draft.id}
            attachments={draft.attachments ?? []}
            studyArtefacts={studyArtefacts}
            expectedTurnType={draft.expectedTurnType}
            onAttachmentsChange={(next) =>
              onChange({ attachments: next })
            }
            onModeChange={(next) =>
              onChange({ expectedTurnType: next })
            }
          />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ padding: 6 }}
          onClick={onCommit}
          aria-label="Save question"
          title="Save changes"
        >
          <Icon name="check" size={13} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: 6 }}
          onClick={onCancel}
          aria-label={draft._local ? "Discard new question" : "Cancel edit"}
          title={draft._local ? "Discard" : "Cancel"}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  );
}

function ArtefactThumb({
  artefact,
  index,
}: {
  artefact: ArtifactRow;
  index: number;
}) {
  if (artefact.kind === "image") {
    return (
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--rule)",
          flexShrink: 0,
          position: "relative",
          display: "inline-block",
          background: "var(--paper-2)",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/uploads/${artefact.path}`}
          alt={artefact.filename}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            background: "var(--card)",
            padding: "1px 4px",
            borderRadius: 2,
            color: "var(--ink-3)",
          }}
        >
          {index + 1}
        </span>
      </span>
    );
  }
  // Document — use mime-type-aware icon
  return (
    <span
      style={{
        width: 56,
        height: 56,
        borderRadius: "var(--r-sm)",
        background: "var(--paper-2)",
        border: "1px solid var(--rule)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-3)",
        flexShrink: 0,
      }}
    >
      <Icon
        name={
          artefact.mimeType.includes("pdf")
            ? "file-text"
            : artefact.mimeType.includes("sheet")
              ? "file-spreadsheet"
              : artefact.mimeType.includes("word") ||
                  artefact.mimeType.includes("document")
                ? "file-type"
                : "file"
        }
        size={22}
      />
    </span>
  );
}

function Artefacts({
  studyId,
  artefacts,
  onChange,
}: {
  studyId: string;
  artefacts: ArtifactRow[];
  onChange: () => void;
}) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/studies/${studyId}/artifacts`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Upload failed for ${file.name}`);
        }
      }
      onChange();
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (artifactId: string) => {
    const target = artefacts.find((a) => a.id === artifactId);
    const ok = await confirm({
      title: "Delete this artefact?",
      body: target ? (
        <>
          <strong style={{ color: "var(--ink)" }}>{target.filename}</strong>{" "}
          will be removed from the study and detached from any plan questions
          that reference it.
        </>
      ) : (
        "This artefact will be removed from the study."
      ),
      tone: "danger",
      confirmLabel: "Delete artefact",
      icon: "trash-2",
    });
    if (!ok) return false;
    try {
      const res = await fetch(
        `/api/studies/${studyId}/artifacts/${encodeURIComponent(artifactId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
      onChange();
      toast.success("Artefact deleted");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      return false;
    }
  };

  return (
    <>
      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {artefacts.length === 0 && (
          <div
            style={{
              padding: 18,
              textAlign: "center",
              color: "var(--ink-3)",
              fontSize: 13,
            }}
          >
            No artefacts yet. Upload screens, mocks, briefs, PDFs, or
            spreadsheets to enable walkthrough questions and ground the
            interview.
          </div>
        )}
        {artefacts.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewIndex(i)}
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
              }}
              title="Preview"
              aria-label={`Preview ${a.filename}`}
            >
              <ArtefactThumb artefact={a} index={i} />
            </button>
            <button
              type="button"
              onClick={() => setPreviewIndex(i)}
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
              title="Preview"
            >
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {a.filename}
              </div>
              <div className="mono" style={{ fontSize: 10 }}>
                {a.kind}
                {a.mimeType ? ` · ${a.mimeType.split("/").pop()}` : ""}
              </div>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: 6 }}
              onClick={() => remove(a.id)}
              title="Remove artefact"
              aria-label={`Remove ${a.filename}`}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.md,.docx,.xlsx,.csv"
          style={{ display: "none" }}
          onChange={onPick}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="upload"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ justifyContent: "center" }}
        >
          {uploading ? "Uploading…" : "Upload artefacts"}
        </Button>
      </div>
      {previewIndex !== null && artefacts[previewIndex] && (
        <ArtefactPreviewModal
          artefacts={artefacts}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onIndexChange={setPreviewIndex}
          onDelete={async (id) => {
            const ok = await remove(id);
            if (ok) setPreviewIndex(null);
          }}
        />
      )}
      {confirmDialog}
    </>
  );
}

function EditableQuestionsList({
  drafts,
  editingId,
  studyId,
  selectedPersonas,
  personasById,
  studyArtefacts,
  canEdit,
  onUpdate,
  onRemove,
  onCommit,
  onCancelEdit,
  onStartEditing,
  onReorder,
  onAdd,
}: {
  drafts: EditableQuestion[];
  editingId: string | null;
  studyId: string;
  selectedPersonas: PersonaDef[];
  personasById: Record<string, PersonaDef>;
  studyArtefacts: ArtifactRow[];
  canEdit: boolean;
  onUpdate: (id: string, patch: Partial<EditableQuestion>) => void;
  onRemove: (id: string) => void;
  onCommit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onStartEditing: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
}) {
  const ids = drafts.map((q) => q.id);
  const dnd = useListDnd<string>(ids, onReorder);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {drafts.map((q, i) => {
        const isEditing = editingId === q.id;
        const dndProps = canEdit
          ? {
              rowProps: dnd.itemProps(q.id),
              rowStyle: dnd.styleFor(q.id),
              handleProps: dnd.handleProps(q.id),
            }
          : undefined;
        return isEditing ? (
          <QuestionRowEdit
            key={q.id}
            draft={q}
            index={i}
            studyId={studyId}
            selectedPersonas={selectedPersonas}
            studyArtefacts={studyArtefacts}
            onChange={(patch) => onUpdate(q.id, patch)}
            onCancel={() => onCancelEdit(q.id)}
            onCommit={() => onCommit(q.id)}
            dnd={dndProps}
          />
        ) : (
          <QuestionRowView
            key={q.id}
            q={q}
            index={i}
            totalPersonas={selectedPersonas.length}
            personasById={personasById}
            onEdit={() => onStartEditing(q.id)}
            onRemove={canEdit ? () => onRemove(q.id) : undefined}
            canEdit={canEdit}
            canReorder={canEdit}
            dnd={dndProps}
          />
        );
      })}
      {canEdit && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onAdd}
          style={{ alignSelf: "flex-start", marginTop: 4 }}
        >
          <Icon name="plus" size={13} /> Add question
        </button>
      )}
    </div>
  );
}

export function StudyDetail({ studyId }: { studyId: string }) {
  const router = useRouter();
  const draft = useStudyDraftStore();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [data, setData] = useState<StudyDetailData | null>(null);
  const [personas, setPersonas] = useState<PersonaDef[]>([]);
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EditableQuestion[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/studies/${studyId}`);
      if (!res.ok) {
        toast.error("Could not load study.");
        return;
      }
      const next = (await res.json()) as StudyDetailData;
      setData(next);
      // Sync drafts from server unless the user is mid-edit; preserve the
      // active row's local edits so a background refresh doesn't blow them away.
      setDrafts((prev) => {
        const editing = prev.find((q) => q.id === editingId);
        const fresh = next.questions.map(
          (q) => ({ ...q }) as EditableQuestion,
        );
        if (!editing) return fresh;
        // Replace the editing row with the local edits where it still exists.
        return fresh.map((q) => (q.id === editing.id ? editing : q));
      });
    } catch {
      toast.error("Could not load study.");
    }
  }, [studyId, editingId]);

  useEffect(() => {
    reload();
    fetch("/api/personas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPersonas)
      .catch(() => undefined);
  }, [reload]);

  if (!data) {
    return (
      <div
        style={{
          padding: "32px 48px",
          maxWidth: 1280,
          margin: "0 auto",
          color: "var(--ink-3)",
        }}
      >
        <Eyebrow>loading</Eyebrow>
      </div>
    );
  }

  const { study, artifacts, plan, questions, reportSections } = data;
  const personasById = Object.fromEntries(personas.map((p) => [p.id, p]));
  const config = study.config
    ? (JSON.parse(study.config) as { selectedPersonaIds?: string[] })
    : { selectedPersonaIds: [] };
  const selectedIds = config.selectedPersonaIds ?? [];
  const selectedPersonas = selectedIds
    .map((id) => personasById[id])
    .filter(Boolean) as PersonaDef[];

  const goalsList = (study.researchGoals ?? "")
    .split(/\r?\n/)
    .map((g) => g.trim())
    .filter(Boolean);

  const hasReport = reportSections.length > 0;
  const hasPlan = Boolean(plan) && questions.length > 0;
  const isRunningOrComplete =
    study.status === "running" || study.status === "completed";

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/plan`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Plan generation failed");
      }
      toast.success("Plan generated");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Plan generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const startRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Run failed");
      }
      toast.success("Study started");
      router.push(`/study/${studyId}/run`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const deleteStudy = async () => {
    const ok = await confirm({
      title: "Delete this study?",
      body: (
        <>
          <strong style={{ color: "var(--ink)" }}>{study.title}</strong> and
          all its data — plan, sessions, transcripts, report, and uploaded
          artefacts — will be permanently removed. This can&apos;t be undone.
        </>
      ),
      tone: "danger",
      confirmLabel: "Delete study",
      icon: "trash-2",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/studies/${studyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
      toast.success("Study deleted");
      router.push("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const cloneStudy = () => {
    draft.reset();
    draft.setTitle(`${study.title} (copy)`);
    draft.setProblemStatement(study.problemStatement);
    draft.setResearchGoals(study.researchGoals ?? "");
    draft.setSessionMode(study.sessionMode);
    draft.setSelectedPersonas(selectedIds);
    router.push("/studies/new");
  };

  // ── Plan editing helpers ─────────────────────────────────
  // Drafts mirror the persisted questions; per-row commits PATCH the whole
  // plan with the current draft state. There is no global save/cancel — each
  // row's "done" (✓) button commits and each "delete" (🗑) confirms then
  // commits the deletion. Drag reorder also commits immediately.
  const updateDraft = (id: string, patch: Partial<EditableQuestion>) => {
    setDrafts((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  };

  const persistDrafts = async (
    nextDrafts: EditableQuestion[],
  ): Promise<boolean> => {
    if (nextDrafts.some((q) => !q.questionText.trim())) {
      toast.error("Every question needs text.");
      return false;
    }
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "edited",
          notes: plan?.notes ?? null,
          questions: nextDrafts.map((q) => ({
            id: q._local ? undefined : q.id,
            questionText: q.questionText.trim(),
            assignedPersonaIds: q.assignedPersonaIds,
            expectedTurnType: q.expectedTurnType,
            notes: q.notes ?? undefined,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      await reload();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSavingPlan(false);
    }
  };

  const commitRow = async (id: string) => {
    const target = drafts.find((q) => q.id === id);
    if (!target) return;
    if (!target.questionText.trim()) {
      toast.error("Question text is required.");
      return;
    }
    const ok = await persistDrafts(drafts);
    if (ok) {
      setEditingId(null);
      toast.success(target._local ? "Question added" : "Question updated");
    }
  };

  const removeDraft = async (id: string) => {
    const target = drafts.find((q) => q.id === id);
    if (!target) return;
    // Local (unsaved) row: drop without an API call or confirm.
    if (target._local) {
      setDrafts((prev) => prev.filter((q) => q.id !== id));
      if (editingId === id) setEditingId(null);
      return;
    }
    const ok = await confirm({
      title: "Delete this question?",
      body: "It will be removed from the plan along with any attached assets. This can't be undone.",
      tone: "danger",
      confirmLabel: "Delete question",
      icon: "trash-2",
    });
    if (!ok) return;
    const next = drafts.filter((q) => q.id !== id);
    const saved = await persistDrafts(next);
    if (saved) {
      if (editingId === id) setEditingId(null);
      toast.success("Question deleted");
    }
  };

  const addDraft = () => {
    const id = `new-${Math.random().toString(36).slice(2, 9)}`;
    setDrafts((prev) => [
      ...prev,
      {
        id,
        questionText: "",
        expectedTurnType: "single",
        assignedPersonaIds: selectedIds,
        _local: true,
      },
    ]);
    setEditingId(id);
  };

  const cancelEdit = (id: string) => {
    const target = drafts.find((q) => q.id === id);
    if (target?._local) {
      // Discard the unsaved local row entirely.
      setDrafts((prev) => prev.filter((q) => q.id !== id));
    } else {
      // Revert this row's local edits to the persisted value.
      const persisted = data?.questions.find((q) => q.id === id);
      if (persisted) {
        setDrafts((prev) =>
          prev.map((q) =>
            q.id === id ? ({ ...persisted } as EditableQuestion) : q,
          ),
        );
      }
    }
    setEditingId(null);
  };

  const persistQuestionOrder = async (orderedIds: string[]) => {
    if (!plan || drafts.length === 0) return;
    const byId = new Map(drafts.map((q) => [q.id, q] as const));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean) as EditableQuestion[];
    if (reordered.length !== drafts.length) return;
    setDrafts(reordered);
    await persistDrafts(reordered);
  };

  return (
    <div
      style={{
        padding: "24px 48px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <button
        type="button"
        onClick={() => router.push("/")}
        className="btn btn-ghost btn-sm"
        style={{
          padding: "4px 8px",
          marginLeft: -8,
          marginBottom: 16,
        }}
      >
        <Icon name="arrow-left" size={13} /> All studies
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          paddingBottom: 24,
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <StatusPill status={study.status} />
            <span className="mono">
              {study.sessionMode === "group" ? "group" : "1-on-1"}
            </span>
          </div>
          <h1
            className="display"
            style={{ fontSize: 40, margin: "0 0 12px" }}
          >
            {study.title}
          </h1>
          <p
            style={{
              color: "var(--ink-3)",
              fontSize: 15,
              lineHeight: 1.6,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {study.problemStatement}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <Button variant="ghost" icon="copy" onClick={cloneStudy}>
            Clone
          </Button>
          <Button
            variant="ghost"
            icon="trash-2"
            onClick={deleteStudy}
            disabled={deleting}
            style={{ color: "var(--emo-frustrated)" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
          {isRunningOrComplete ? (
            <>
              <Link
                href={`/study/${studyId}/run`}
                style={{ textDecoration: "none" }}
              >
                <Button variant="secondary" icon="radio">
                  {study.status === "completed"
                    ? "View transcript"
                    : "Open run"}
                </Button>
              </Link>
              {hasReport && (
                <Link
                  href={`/study/${studyId}/report`}
                  style={{ textDecoration: "none" }}
                >
                  <Button variant="primary" icon="file-text">
                    View report
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <Button
              variant="primary"
              icon="play"
              disabled={!hasPlan || running}
              onClick={startRun}
            >
              {running ? "Starting…" : "Start study"}
            </Button>
          )}
        </div>
      </div>

      {/* Three-column work area */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr 0.9fr",
          gap: 28,
          marginTop: 32,
        }}
      >
        {/* LEFT: goals + personas */}
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <SectionHeader number="01" title="Goals" />
          {goalsList.length === 0 ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-3)",
                margin: 0,
              }}
            >
              No goals captured.
            </p>
          ) : (
            <ol
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {goalsList.map((g, i) => (
                <li
                  key={i}
                  style={{ display: "flex", gap: 12 }}
                >
                  <span
                    className="mono"
                    style={{ color: "var(--ink-4)", minWidth: 18 }}
                  >
                    0{i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--ink-2)",
                      lineHeight: 1.55,
                    }}
                  >
                    {g}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <hr className="rule" />

          <SectionHeader
            number="02"
            title="Personas"
            right={
              <span className="mono" style={{ fontSize: 10 }}>
                {selectedPersonas.length}
              </span>
            }
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {selectedPersonas.map((p) => {
              const visual = p as unknown as PersonaVisual;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Avatar persona={visual} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: "var(--ink)",
                        fontWeight: 500,
                      }}
                    >
                      {personaShortName(visual)}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-3)",
                      }}
                    >
                      {personaTitle(visual)}
                    </div>
                  </div>
                  <TechBadge level={personaTech(visual)} />
                </div>
              );
            })}
          </div>
        </aside>

        {/* MIDDLE: research plan */}
        <section style={{ minWidth: 0 }}>
          <SectionHeader
            number="03"
            title="Research plan"
            right={
              <div style={{ display: "flex", gap: 4 }}>
                {savingPlan && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "var(--ink-3)",
                      alignSelf: "center",
                      paddingRight: 6,
                    }}
                  >
                    saving…
                  </span>
                )}
                {hasPlan && !isRunningOrComplete && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: "2px 8px" }}
                    onClick={generatePlan}
                    disabled={generating}
                  >
                    <Icon name="refresh-cw" size={12} />{" "}
                    {generating ? "regenerating…" : "regenerate"}
                  </button>
                )}
              </div>
            }
          />

          {!hasPlan && !generating && (
            <PlanEmpty
              onGenerate={generatePlan}
              hasArtefacts={artifacts.length > 0}
              busy={false}
            />
          )}
          {generating && <PlanGenerating />}
          {hasPlan && !generating && (
            <EditableQuestionsList
              drafts={drafts}
              editingId={editingId}
              studyId={studyId}
              selectedPersonas={selectedPersonas}
              personasById={personasById}
              studyArtefacts={artifacts}
              canEdit={!isRunningOrComplete}
              onUpdate={updateDraft}
              onRemove={removeDraft}
              onCommit={commitRow}
              onCancelEdit={cancelEdit}
              onStartEditing={(qid) => setEditingId(qid)}
              onReorder={persistQuestionOrder}
              onAdd={addDraft}
            />
          )}
        </section>

        {/* RIGHT: artefacts */}
        <aside style={{ minWidth: 0 }}>
          <SectionHeader
            number="04"
            title="Artefacts"
            right={
              <span className="mono">{artifacts.length}</span>
            }
          />
          <Artefacts
            studyId={studyId}
            artefacts={artifacts}
            onChange={reload}
          />
        </aside>
      </div>
      {confirmDialog}
    </div>
  );
}
