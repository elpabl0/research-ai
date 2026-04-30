"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Eyebrow,
  Icon,
  TechBadge,
  type PersonaVisual,
  personaShortName,
  personaTitle,
  personaTech,
  personaBlurb,
  personaTraits,
  personaPains,
  personaStyle,
} from "@/components/research/primitives";
import { PersonaForm } from "@/components/research/persona-form";
import { useConfirm } from "@/components/research/confirm-dialog";
import type { PersonaDef } from "@/config/personas";

function PersonaField({
  label,
  body,
  list,
}: {
  label: string;
  body?: string;
  list?: string[];
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      {body && (
        <p
          style={{
            marginTop: 10,
            fontSize: 14.5,
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}
        >
          {body}
        </p>
      )}
      {list && list.length > 0 && (
        <ul
          style={{
            margin: "10px 0 0",
            paddingLeft: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {list.map((x, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 14,
                color: "var(--ink-2)",
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "var(--ink-3)",
                  marginTop: 9,
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PersonaLibrary() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [personas, setPersonas] = useState<PersonaDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch("/api/personas");
    if (res.ok) {
      const data = (await res.json()) as PersonaDef[];
      setPersonas(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/personas");
      if (cancelled || !res.ok) return;
      const data = (await res.json()) as PersonaDef[];
      setPersonas(data);
      if (data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persona = useMemo(
    () => personas.find((p) => p.id === selectedId) ?? null,
    [personas, selectedId],
  );
  const visual = persona as unknown as PersonaVisual | null;

  const filtered = useMemo(() => {
    if (!search.trim()) return personas;
    const q = search.toLowerCase();
    return personas.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.title ?? "").toLowerCase().includes(q),
    );
  }, [personas, search]);

  const presetCount = personas.filter((p) => p.isPreset).length;
  const customCount = personas.length - presetCount;

  const removeCustom = async (id: string) => {
    const target = personas.find((p) => p.id === id);
    const ok = await confirm({
      title: "Delete this persona?",
      body: target ? (
        <>
          <strong style={{ color: "var(--ink)" }}>
            {personaShortName(target as unknown as PersonaVisual)}
          </strong>{" "}
          will be removed from the library. Existing studies that already
          reference this persona keep their snapshot — only the editable
          definition is deleted.
        </>
      ) : (
        "This persona will be removed from the library."
      ),
      tone: "danger",
      confirmLabel: "Delete persona",
      icon: "trash-2",
    });
    if (!ok) return;
    const res = await fetch(
      `/api/personas/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Could not delete");
      return;
    }
    toast.success("Persona deleted");
    await load();
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "380px 1fr",
        minHeight: "100vh",
      }}
    >
      {/* List */}
      <aside
        style={{
          borderRight: "1px solid var(--rule)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "24px 24px 18px" }}>
          <Eyebrow>Library</Eyebrow>
          <h2
            className="display"
            style={{ fontSize: 28, margin: "8px 0 4px" }}
          >
            Personas
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-3)",
              margin: 0,
            }}
          >
            {personas.length} personas · {presetCount} default,{" "}
            {customCount} custom
          </p>
        </div>
        <div style={{ padding: "0 16px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--card)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r)",
            }}
          >
            <Icon
              name="search"
              size={14}
              style={{ color: "var(--ink-3)" }}
            />
            <input
              placeholder="Search personas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: "transparent",
                fontFamily: "inherit",
                fontSize: 13,
                color: "var(--ink)",
              }}
            />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 12px",
          }}
        >
          {loading && (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--ink-3)",
                fontSize: 12,
              }}
            >
              <Eyebrow>loading</Eyebrow>
            </div>
          )}
          {filtered.map((p) => {
            const active = p.id === selectedId;
            const v = p as unknown as PersonaVisual;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setEditing(false);
                  setCreating(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 12px",
                  background: active ? "var(--paper-2)" : "transparent",
                  border: "1px solid",
                  borderColor: active ? "var(--rule)" : "transparent",
                  borderRadius: "var(--r)",
                  cursor: "pointer",
                  marginBottom: 4,
                  transition: "all var(--dur) var(--ease)",
                }}
              >
                <Avatar persona={v} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        color: "var(--ink)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {personaShortName(v)}
                    </span>
                    <TechBadge level={personaTech(v)} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {personaTitle(v)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--rule)",
          }}
        >
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setCreating(true);
              setEditing(false);
              setSelectedId(null);
            }}
            style={{ width: "100%", justifyContent: "center" }}
          >
            New persona
          </Button>
        </div>
      </aside>

      {/* Detail / form */}
      <main style={{ overflowY: "auto" }}>
        {creating ? (
          <div style={{ padding: "40px 56px", maxWidth: 880 }}>
            <Eyebrow>New persona</Eyebrow>
            <h1
              className="display"
              style={{ fontSize: 36, margin: "8px 0 24px" }}
            >
              Create a custom persona.
            </h1>
            <PersonaForm
              onSaved={async () => {
                setCreating(false);
                await load();
              }}
            />
            <div style={{ marginTop: 16 }}>
              <Button
                variant="ghost"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : !persona || !visual ? (
          <div
            style={{
              padding: 80,
              textAlign: "center",
              color: "var(--ink-3)",
            }}
          >
            Select a persona from the library.
          </div>
        ) : editing ? (
          <div style={{ padding: "40px 56px", maxWidth: 880 }}>
            <Eyebrow>Editing {personaShortName(visual)}</Eyebrow>
            <h1
              className="display"
              style={{ fontSize: 36, margin: "8px 0 24px" }}
            >
              Edit persona
            </h1>
            <PersonaForm
              persona={persona}
              onSaved={async () => {
                setEditing(false);
                await load();
              }}
            />
            <div style={{ marginTop: 16 }}>
              <Button
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ padding: "40px 56px", maxWidth: 880 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 24,
                marginBottom: 36,
                flexWrap: "wrap",
              }}
            >
              <Avatar persona={visual} size={88} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <Eyebrow>persona profile</Eyebrow>
                <h1
                  className="display"
                  style={{ fontSize: 44, margin: "8px 0 6px" }}
                >
                  {personaShortName(visual)}{" "}
                  <span
                    className="italic-serif"
                    style={{ color: "var(--ink-3)" }}
                  >
                    ·
                  </span>{" "}
                  <span
                    style={{
                      fontSize: 24,
                      color: "var(--ink-3)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {personaTitle(visual)}
                  </span>
                </h1>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <TechBadge level={personaTech(visual)} />
                  {persona.demographics?.age && (
                    <span className="pill">
                      <Icon name="user" size={11} /> age{" "}
                      {persona.demographics.age}
                    </span>
                  )}
                  {persona.isPreset ? (
                    <span className="pill">preset</span>
                  ) : (
                    <span
                      className="pill"
                      style={{
                        background: "var(--emo-positive-bg)",
                        color: "var(--emo-positive)",
                      }}
                    >
                      custom
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  variant="secondary"
                  icon="edit-3"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                {!persona.isPreset && (
                  <Button
                    variant="ghost"
                    icon="trash-2"
                    style={{ color: "var(--emo-frustrated)" }}
                    onClick={() => removeCustom(persona.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <p
              style={{
                fontSize: 18,
                color: "var(--ink-2)",
                lineHeight: 1.6,
                fontFamily: "var(--font-display)",
                marginBottom: 36,
                maxWidth: 700,
              }}
            >
              {personaBlurb(visual)}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 32,
              }}
            >
              <PersonaField
                label="Communication style"
                body={personaStyle(visual)}
              />
              <PersonaField
                label="Behavioural traits"
                list={personaTraits(visual)}
              />
              <PersonaField label="Goals" list={persona.goals} />
              <PersonaField
                label="Pain points"
                list={personaPains(visual)}
              />
            </div>

            <hr className="rule" style={{ margin: "40px 0" }} />

            <div>
              <Eyebrow>System prompt fragment</Eyebrow>
              <div
                className="card"
                style={{
                  marginTop: 12,
                  padding: 20,
                  background: "var(--paper-2)",
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                    lineHeight: 1.65,
                    color: "var(--ink-2)",
                    whiteSpace: "pre-wrap",
                    textWrap: "pretty",
                  }}
                >
                  {persona.systemPromptFragment}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
      {confirmDialog}
    </div>
  );
}
