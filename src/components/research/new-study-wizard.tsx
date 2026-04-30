"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStudyDraftStore } from "@/stores/study-store";
import {
  Avatar,
  Button,
  Eyebrow,
  Icon,
  TechBadge,
  type PersonaVisual,
} from "@/components/research/primitives";
import {
  personaShortName,
  personaTitle,
  personaTech,
  personaBlurb,
} from "@/components/research/primitives";
import type { PersonaDef } from "@/config/personas";

interface DraftData {
  title: string;
  problem: string;
  goals: [string, string, string];
  mode: "one_on_one" | "group";
  personas: string[];
}

const STEPS = [
  { id: "brief", label: "Brief" },
  { id: "mode", label: "Mode" },
  { id: "personas", label: "Personas" },
  { id: "review", label: "Review" },
] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={s.id}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: `1px solid ${
                    active || done ? "var(--ink)" : "var(--rule-strong)"
                  }`,
                  background: done ? "var(--ink)" : "transparent",
                  color: done
                    ? "var(--paper)"
                    : active
                      ? "var(--ink)"
                      : "var(--ink-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all var(--dur) var(--ease)",
                }}
              >
                {done ? <Icon name="check" size={11} stroke={2} /> : i + 1}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: active ? "var(--ink)" : "var(--ink-3)",
                  fontFamily: "var(--font-sans)",
                  transition: "color var(--dur) var(--ease)",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                style={{
                  flex: 1,
                  maxWidth: 80,
                  height: 1,
                  background: "var(--rule)",
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function BriefScore({ data }: { data: DraftData }) {
  const t = data.title.trim().length;
  const p = data.problem.trim().length;
  const g = data.goals.filter((x) => x.trim()).length;
  const score = Math.min(
    100,
    Math.round(
      (Math.min(t, 80) / 80) * 30 +
        (Math.min(p, 240) / 240) * 50 +
        (g / 3) * 20,
    ),
  );
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          className="display"
          style={{ fontSize: 38, lineHeight: 1, fontWeight: 300 }}
        >
          {score}
        </span>
        <span className="mono" style={{ marginBottom: 4 }}>
          / 100
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--paper-3)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            background: "var(--ink)",
            transition: "width 320ms var(--ease)",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-3)",
          marginTop: 10,
          lineHeight: 1.55,
        }}
      >
        {score < 30 && "Add more detail — personas need a concrete brief."}
        {score >= 30 && score < 70 &&
          "Specific enough to produce useful transcripts."}
        {score >= 70 && "Strong brief. Personas can reason in context."}
      </div>
    </div>
  );
}

function BriefStep({
  data,
  setData,
}: {
  data: DraftData;
  setData: (d: DraftData) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        gap: 56,
      }}
    >
      <div>
        <Eyebrow>Step 01</Eyebrow>
        <h2
          className="display"
          style={{ fontSize: 36, margin: "12px 0 8px" }}
        >
          Define the study.
        </h2>
        <p
          style={{
            color: "var(--ink-3)",
            fontSize: 15,
            marginBottom: 36,
            maxWidth: 540,
          }}
        >
          Be specific. The problem statement and research goals are passed into
          every persona prompt — vague briefs produce vague answers.
        </p>

        <label className="label">Study title</label>
        <input
          className="input"
          placeholder="e.g. Onboarding friction in financial sign-up flows"
          value={data.title}
          onChange={(e) => setData({ ...data, title: e.target.value })}
        />

        <div style={{ height: 24 }} />
        <label className="label">Problem statement</label>
        <textarea
          className="textarea"
          rows={4}
          placeholder="What are you trying to learn? Who is affected? What decision will this inform?"
          value={data.problem}
          onChange={(e) => setData({ ...data, problem: e.target.value })}
        />

        <div style={{ height: 24 }} />
        <label className="label">Research goals · up to three</label>
        <div
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {data.goals.map((g, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span
                className="mono"
                style={{ width: 22, color: "var(--ink-4)" }}
              >
                0{i + 1}
              </span>
              <input
                className="input"
                placeholder={`Goal ${i + 1}`}
                value={g}
                onChange={(e) => {
                  const goals = [...data.goals] as DraftData["goals"];
                  goals[i] = e.target.value;
                  setData({ ...data, goals });
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <aside style={{ position: "sticky", top: 24, alignSelf: "flex-start" }}>
        <div className="card" style={{ padding: 18 }}>
          <Eyebrow>Why this matters</Eyebrow>
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              marginTop: 10,
            }}
          >
            Personas reason from the brief. A title like &ldquo;onboarding
            feedback&rdquo; yields stock answers. A title that names{" "}
            <em className="italic-serif">who, where</em> and{" "}
            <em className="italic-serif">what decision</em> produces sharper
            transcripts.
          </p>
          <hr className="rule" style={{ margin: "14px 0" }} />
          <div className="mono" style={{ fontSize: 10, marginBottom: 6 }}>
            quality signal
          </div>
          <BriefScore data={data} />
        </div>
      </aside>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
  tags,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
  tags: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 24,
        background: active ? "var(--card)" : "var(--paper)",
        border: `1px solid ${active ? "var(--ink)" : "var(--rule)"}`,
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "all var(--dur) var(--ease)",
        boxShadow: active ? "0 0 0 2px rgba(26,24,20,0.08)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r)",
            background: active ? "var(--ink)" : "var(--paper-2)",
            color: active ? "var(--paper)" : "var(--ink-2)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all var(--dur) var(--ease)",
          }}
        >
          <Icon name={icon} size={20} />
        </span>
        {active && (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "var(--ink)",
              color: "var(--paper)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={9} stroke={2} />
          </span>
        )}
      </div>
      <h3
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 400,
          margin: 0,
          color: "var(--ink)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          color: "var(--ink-3)",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}
      >
        {tags.map((t) => (
          <span key={t} className="pill">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

function ModeStep({
  data,
  setData,
}: {
  data: DraftData;
  setData: (d: DraftData) => void;
}) {
  return (
    <div>
      <Eyebrow>Step 02</Eyebrow>
      <h2
        className="display"
        style={{ fontSize: 36, margin: "12px 0 8px" }}
      >
        How should the study run?
      </h2>
      <p
        style={{
          color: "var(--ink-3)",
          fontSize: 15,
          marginBottom: 36,
          maxWidth: 600,
        }}
      >
        One-on-one interviews surface depth. Group sessions surface tension
        between archetypes — personas hear and respond to each other.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          maxWidth: 880,
        }}
      >
        <ModeCard
          active={data.mode === "one_on_one"}
          onClick={() => setData({ ...data, mode: "one_on_one" })}
          icon="user"
          title="1-on-1 interviews"
          description="Each persona answers in their own session. Best for deep-dive flows and edge-case probing."
          tags={["focused", "sequential", "longer report"]}
        />
        <ModeCard
          active={data.mode === "group"}
          onClick={() => setData({ ...data, mode: "group" })}
          icon="users"
          title="Group session"
          description="All selected personas in one streaming room. They reference each other's answers — surfaces conflict and consensus."
          tags={["conversational", "parallel", "shorter report"]}
        />
      </div>
    </div>
  );
}

function PersonasStep({
  data,
  setData,
  personas,
}: {
  data: DraftData;
  setData: (d: DraftData) => void;
  personas: PersonaDef[];
}) {
  const toggle = (id: string) => {
    const next = data.personas.includes(id)
      ? data.personas.filter((p) => p !== id)
      : [...data.personas, id];
    setData({ ...data, personas: next });
  };
  return (
    <div>
      <Eyebrow>Step 03</Eyebrow>
      <h2
        className="display"
        style={{ fontSize: 36, margin: "12px 0 8px" }}
      >
        Pick your personas.
      </h2>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
          maxWidth: 800,
        }}
      >
        <p
          style={{
            color: "var(--ink-3)",
            fontSize: 15,
            margin: 0,
          }}
        >
          Choose at least one. Each persona brings their own goals, pains and
          behavioural traits to the conversation.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {personas.map((p) => {
          const selected = data.personas.includes(p.id);
          const visual = p as unknown as PersonaVisual;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              style={{
                textAlign: "left",
                padding: 16,
                background: selected ? "var(--card)" : "var(--paper)",
                border: `1px solid ${
                  selected ? "var(--ink)" : "var(--rule)"
                }`,
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                transition: "all var(--dur) var(--ease)",
                position: "relative",
                boxShadow: selected
                  ? "0 0 0 2px rgba(26,24,20,0.08)"
                  : "none",
              }}
            >
              <Avatar persona={visual} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {personaShortName(visual)}
                  </span>
                  <TechBadge level={personaTech(visual)} />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-3)",
                    marginTop: 1,
                  }}
                >
                  {personaTitle(visual)}
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-3)",
                    margin: "8px 0 0",
                    lineHeight: 1.45,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {personaBlurb(visual)}
                </p>
              </div>
              {selected && (
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "var(--ink)",
                    color: "var(--paper)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="check" size={11} stroke={2} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "var(--ink-3)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {data.personas.length} selected
      </div>
    </div>
  );
}

function ReviewStep({
  data,
  personas,
}: {
  data: DraftData;
  personas: PersonaDef[];
}) {
  const personasById = Object.fromEntries(personas.map((p) => [p.id, p]));
  const selected = data.personas
    .map((id) => personasById[id])
    .filter(Boolean) as PersonaDef[];
  return (
    <div>
      <Eyebrow>Step 04</Eyebrow>
      <h2
        className="display"
        style={{ fontSize: 36, margin: "12px 0 8px" }}
      >
        Review and create.
      </h2>
      <p
        style={{
          color: "var(--ink-3)",
          fontSize: 15,
          marginBottom: 36,
          maxWidth: 600,
        }}
      >
        After creating the study you can upload artefacts, generate a question
        plan, and review before going live.
      </p>
      <div
        className="card"
        style={{
          padding: 28,
          display: "grid",
          gridTemplateColumns: "160px 1fr",
          rowGap: 20,
          columnGap: 32,
        }}
      >
        <span className="label" style={{ margin: 0 }}>
          Title
        </span>
        <span
          className="serif"
          style={{ fontSize: 22, color: "var(--ink)" }}
        >
          {data.title || <em className="dim">—</em>}
        </span>

        <span className="label" style={{ margin: 0 }}>
          Problem
        </span>
        <span
          style={{
            color: "var(--ink-2)",
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {data.problem || <em className="dim">—</em>}
        </span>

        <span className="label" style={{ margin: 0 }}>
          Goals
        </span>
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            color: "var(--ink-2)",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {data.goals.filter((g) => g.trim()).map((g, i) => (
            <li key={i}>{g}</li>
          ))}
          {data.goals.filter((g) => g.trim()).length === 0 && (
            <li>
              <em className="dim">none specified</em>
            </li>
          )}
        </ol>

        <span className="label" style={{ margin: 0 }}>
          Mode
        </span>
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Icon
            name={data.mode === "group" ? "users" : "user"}
            size={16}
          />
          <span style={{ fontSize: 14 }}>
            {data.mode === "group"
              ? "Group session"
              : "One-on-one interviews"}
          </span>
        </span>

        <span className="label" style={{ margin: 0 }}>
          Personas
        </span>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {selected.map((p) => (
            <span
              key={p.id}
              className="pill"
              style={{ paddingLeft: 4 }}
            >
              <Avatar
                persona={p as unknown as PersonaVisual}
                size={18}
                withGlyph={false}
              />
              {personaShortName(p as unknown as PersonaVisual)}
            </span>
          ))}
          {selected.length === 0 && (
            <em className="dim">none selected</em>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewStudyWizard() {
  const router = useRouter();
  const draftStore = useStudyDraftStore();
  const [personas, setPersonas] = useState<PersonaDef[]>([]);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<DraftData>(() => {
    // Hydrate from the cross-page draft store (used by Clone study, etc.).
    const goalLines = (draftStore.researchGoals ?? "")
      .split(/\r?\n/)
      .filter((g, i, arr) => g.trim() || i < arr.length - 1);
    const goals: [string, string, string] = ["", "", ""];
    goalLines.slice(0, 3).forEach((g, i) => {
      goals[i] = g;
    });
    return {
      title: draftStore.title,
      problem: draftStore.problemStatement,
      goals,
      mode: draftStore.sessionMode,
      personas: [...draftStore.selectedPersonaIds],
    };
  });

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPersonas)
      .catch(() => undefined);
  }, []);

  const canNext = () => {
    if (step === 0)
      return (
        data.title.trim() &&
        data.problem.trim() &&
        data.goals.some((g) => g.trim())
      );
    if (step === 1) return Boolean(data.mode);
    if (step === 2) return data.personas.length > 0;
    return true;
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      const goals = data.goals.filter((g) => g.trim()).join("\n");
      const res = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          problemStatement: data.problem,
          researchGoals: goals,
          sessionMode: data.mode,
          selectedPersonaIds: data.personas,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create study");
      }
      const { id } = (await res.json()) as { id: string };
      toast.success("Study created");
      draftStore.reset();
      router.push(`/study/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: "24px 48px",
        maxWidth: 1080,
        margin: "0 auto",
      }}
    >
      <button
        type="button"
        onClick={() => router.push("/")}
        className="btn btn-ghost btn-sm"
        style={{
          marginBottom: 16,
          padding: "4px 8px",
          marginLeft: -8,
        }}
      >
        <Icon name="arrow-left" size={13} /> All studies
      </button>

      <Stepper current={step} />

      <div style={{ marginTop: 36 }}>
        {step === 0 && <BriefStep data={data} setData={setData} />}
        {step === 1 && <ModeStep data={data} setData={setData} />}
        {step === 2 && (
          <PersonasStep
            data={data}
            setData={setData}
            personas={personas}
          />
        )}
        {step === 3 && <ReviewStep data={data} personas={personas} />}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid var(--rule)",
        }}
      >
        <Button
          variant="ghost"
          icon="arrow-left"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        {step < 3 ? (
          <Button
            variant="primary"
            trailingIcon="arrow-right"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="primary"
            trailingIcon="check"
            disabled={submitting}
            onClick={finish}
          >
            {submitting ? "Creating…" : "Create study"}
          </Button>
        )}
      </div>
    </div>
  );
}
