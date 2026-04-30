"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Eyebrow,
  Icon,
  PageHeader,
  Segmented,
  StatusPill,
  type PersonaVisual,
} from "@/components/research/primitives";
import type { PersonaDef } from "@/config/personas";

interface StudyRow {
  id: string;
  title: string;
  problemStatement: string;
  status: "draft" | "running" | "completed" | string;
  sessionMode: "one_on_one" | "group";
  createdAt: string | number;
  config: string | null;
}

type Filter = "all" | "running" | "draft" | "completed";

function formatDate(value: string | number) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function modeLabel(mode: string) {
  return mode === "group" ? "group" : "1-on-1";
}

function StudyCard({
  study,
  personasById,
}: {
  study: StudyRow;
  personasById: Record<string, PersonaDef>;
}) {
  const config = useMemo(() => {
    if (!study.config) return { selectedPersonaIds: [] as string[] };
    try {
      return JSON.parse(study.config) as { selectedPersonaIds?: string[] };
    } catch {
      return { selectedPersonaIds: [] as string[] };
    }
  }, [study.config]);
  const selected = config.selectedPersonaIds ?? [];
  const personas = selected
    .map((id) => personasById[id])
    .filter(Boolean) as PersonaDef[];

  const href = `/study/${study.id}`;

  return (
    <Link
      href={href}
      className="card row-link"
      style={{
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "pointer",
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <StatusPill status={study.status} />
        <span className="mono" style={{ fontSize: 10 }}>
          {formatDate(study.createdAt)}
        </span>
      </div>
      <h3
        className="serif"
        style={{
          margin: 0,
          fontWeight: 400,
          fontSize: 22,
          lineHeight: 1.2,
          color: "var(--ink)",
        }}
      >
        {study.title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          color: "var(--ink-3)",
          lineHeight: 1.55,
          textWrap: "pretty",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {study.problemStatement}
      </p>
      <hr className="rule" style={{ margin: "4px 0" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {personas.slice(0, 5).map((p, i) => (
            <span
              key={p.id}
              style={{ marginLeft: i === 0 ? 0 : -8 }}
            >
              <Avatar
                persona={p as unknown as PersonaVisual}
                size={26}
                withGlyph={false}
              />
            </span>
          ))}
          {personas.length > 5 && (
            <span
              style={{
                marginLeft: -8,
                width: 26,
                height: 26,
                borderRadius: 999,
                background: "var(--paper-2)",
                border: "1px solid var(--rule)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--ink-3)",
              }}
            >
              +{personas.length - 5}
            </span>
          )}
          {personas.length === 0 && (
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-4)" }}
            >
              no personas
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-3)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icon
              name={study.sessionMode === "group" ? "users" : "user"}
              size={12}
            />
            {modeLabel(study.sessionMode)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function StudiesIndex() {
  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [personas, setPersonas] = useState<PersonaDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sRes, pRes] = await Promise.all([
          fetch("/api/studies"),
          fetch("/api/personas"),
        ]);
        if (cancelled) return;
        if (sRes.ok) setStudies(await sRes.json());
        if (pRes.ok) setPersonas(await pRes.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const personasById = useMemo(
    () => Object.fromEntries(personas.map((p) => [p.id, p])),
    [personas],
  );

  const filtered = useMemo(() => {
    const normalize = (status: string): "running" | "draft" | "completed" | string => {
      if (status === "running" || status === "draft" || status === "completed") return status;
      if (status === "report_ready") return "completed";
      // draft, plan_ready, plan_failed, etc → all "in progress" prior to running
      return "draft";
    };
    const normalized = studies.map((s) => ({ ...s, status: normalize(s.status) }));
    if (filter === "all") return normalized;
    return normalized.filter((s) => s.status === filter);
  }, [studies, filter]);

  return (
    <div
      style={{
        padding: "32px 48px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <PageHeader
        eyebrow="Workspace"
        title={
          <>
            Your{" "}
            <span
              className="italic-serif"
              style={{ color: "var(--ink-3)" }}
            >
              research
            </span>{" "}
            studies
          </>
        }
        subtitle="Run agentic interviews and group sessions with AI personas. Each study captures questions, responses, emotional signal, and a synthesised report."
        right={
          <Link href="/studies/new" style={{ textDecoration: "none" }}>
            <Button variant="primary" icon="plus">
              New study
            </Button>
          </Link>
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          marginTop: 28,
        }}
      >
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", icon: "list" },
            { value: "running", label: "Running", icon: "radio" },
            { value: "draft", label: "Drafts", icon: "file" },
            { value: "completed", label: "Completed", icon: "check" },
          ]}
        />
        <div
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <span className="mono" style={{ fontSize: 11 }}>
            {filtered.length} stud{filtered.length === 1 ? "y" : "ies"}
          </span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: 80,
            textAlign: "center",
            color: "var(--ink-3)",
          }}
        >
          <Eyebrow>loading</Eyebrow>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--ink-3)",
            border: "1px dashed var(--rule)",
            borderRadius: "var(--r-md)",
          }}
        >
          <p style={{ margin: "0 0 16px", fontSize: 14 }}>
            {filter === "all"
              ? "No studies yet. Create your first one to get started."
              : `No studies in the ${filter} state.`}
          </p>
          {filter === "all" && (
            <Link href="/studies/new" style={{ textDecoration: "none" }}>
              <Button variant="primary" icon="plus">
                New study
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((s) => (
            <StudyCard
              key={s.id}
              study={s}
              personasById={personasById}
            />
          ))}
        </div>
      )}
    </div>
  );
}
