"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/research/primitives";
import type { PersonaDef } from "@/config/personas";

type DraftPersona = Omit<PersonaDef, "id" | "isPreset"> & { id?: string };

interface PersonaFormProps {
  persona?: PersonaDef;
  onSaved: () => void;
}

export function PersonaForm({ persona, onSaved }: PersonaFormProps) {
  const [draft, setDraft] = useState<DraftPersona>(() => ({
    id: persona?.id,
    name: persona?.name ?? "",
    avatar: persona?.avatar ?? "👤",
    color: persona?.color ?? "#6366F1",
    description: persona?.description ?? "",
    demographics: persona?.demographics ?? {},
    goals: persona?.goals ?? [],
    painPoints: persona?.painPoints ?? [],
    techComfort: persona?.techComfort ?? "medium",
    behaviouralTraits: persona?.behaviouralTraits ?? [],
    communicationStyle: persona?.communicationStyle ?? "",
    systemPromptFragment: persona?.systemPromptFragment ?? "",
  }));
  const [saving, setSaving] = useState(false);

  const linesField = (
    label: string,
    field: "goals" | "painPoints" | "behaviouralTraits",
    placeholder: string,
  ) => (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="textarea"
        value={draft[field].join("\n")}
        onChange={(e) =>
          setDraft({
            ...draft,
            [field]: e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder={placeholder}
        rows={4}
      />
      <p
        style={{
          fontSize: 10,
          color: "var(--ink-4)",
          marginTop: 4,
          fontFamily: "var(--font-mono)",
        }}
      >
        One per line.
      </p>
    </div>
  );

  const submit = async () => {
    if (!draft.name.trim() || !draft.systemPromptFragment.trim()) {
      toast.error("Name and system prompt fragment are required.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(persona?.id);
      const url = isEdit
        ? `/api/personas/${encodeURIComponent(persona!.id)}`
        : "/api/personas";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Save failed");
      toast.success("Persona saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: 26,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <div>
          <label className="label">Initials / avatar</label>
          <input
            className="input"
            value={draft.avatar}
            onChange={(e) =>
              setDraft({ ...draft, avatar: e.target.value })
            }
            maxLength={4}
            style={{
              fontSize: 16,
              textAlign: "center",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>
        <div>
          <label className="label">Accent colour</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="color"
              value={draft.color}
              onChange={(e) =>
                setDraft({ ...draft, color: e.target.value })
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--r)",
                border: "1px solid var(--rule)",
                background: "transparent",
                padding: 2,
                cursor: "pointer",
              }}
            />
            <input
              className="input"
              value={draft.color}
              onChange={(e) =>
                setDraft({ ...draft, color: e.target.value })
              }
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
        </div>
      </div>
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. Tech-Savvy Millennial"
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="textarea"
          value={draft.description}
          onChange={(e) =>
            setDraft({ ...draft, description: e.target.value })
          }
          rows={2}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <div>
          <label className="label">Tech comfort</label>
          <select
            className="input"
            value={draft.techComfort}
            onChange={(e) =>
              setDraft({
                ...draft,
                techComfort: e.target.value as "low" | "medium" | "high",
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="label">Communication style</label>
          <input
            className="input"
            value={draft.communicationStyle}
            onChange={(e) =>
              setDraft({ ...draft, communicationStyle: e.target.value })
            }
            placeholder="Polite, careful, asks questions"
          />
        </div>
      </div>
      {linesField(
        "Goals",
        "goals",
        "Get the task done quickly\nUse the app one-handed",
      )}
      {linesField(
        "Pain points",
        "painPoints",
        "Long sign-up forms\nTiny touch targets",
      )}
      {linesField(
        "Behavioural traits",
        "behaviouralTraits",
        "Skims rather than reads\nBacks out at the first sign of confusion",
      )}
      <div>
        <label className="label">System prompt fragment</label>
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-3)",
            margin: "0 0 8px",
          }}
        >
          Injected into every interview prompt. Speak in the second person
          about who they are and how they react.
        </p>
        <textarea
          className="textarea"
          value={draft.systemPromptFragment}
          onChange={(e) =>
            setDraft({ ...draft, systemPromptFragment: e.target.value })
          }
          rows={6}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="primary"
          icon="save"
          onClick={submit}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save persona"}
        </Button>
      </div>
    </div>
  );
}
