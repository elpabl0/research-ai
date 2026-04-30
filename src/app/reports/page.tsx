"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Eyebrow,
  Icon,
  PageHeader,
  type PersonaVisual,
} from "@/components/research/primitives";
import type { PersonaDef } from "@/config/personas";

interface StudyRow {
  id: string;
  title: string;
  status: string;
  createdAt: string | number;
  config: string | null;
}

function formatDate(value: string | number) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReportsIndexPage() {
  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [personas, setPersonas] = useState<PersonaDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/studies"),
        fetch("/api/personas"),
      ]);
      if (cancelled) return;
      if (sRes.ok) setStudies(await sRes.json());
      if (pRes.ok) setPersonas(await pRes.json());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const personasById = useMemo(
    () => Object.fromEntries(personas.map((p) => [p.id, p])),
    [personas],
  );

  const completed = studies.filter(
    (s) => s.status === "completed" || s.status === "report_ready",
  );

  return (
    <div
      style={{
        padding: "32px 48px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <PageHeader
        eyebrow="Outputs"
        title="Reports"
        subtitle="Synthesised reports from completed studies. Each report is generated automatically when a study ends, and can be exported as a PDF."
      />
      <div style={{ marginTop: 28 }}>
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
        ) : completed.length === 0 ? (
          <div
            style={{
              padding: 80,
              textAlign: "center",
              color: "var(--ink-3)",
              fontSize: 14,
            }}
          >
            No completed studies yet.
          </div>
        ) : (
          completed.map((s) => {
            const config = s.config
              ? (JSON.parse(s.config) as {
                  selectedPersonaIds?: string[];
                })
              : { selectedPersonaIds: [] };
            const ps = (config.selectedPersonaIds ?? [])
              .map((id) => personasById[id])
              .filter(Boolean) as PersonaDef[];
            return (
              <Link
                key={s.id}
                href={`/study/${s.id}/report`}
                className="row-link"
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 200px 100px",
                  alignItems: "center",
                  gap: 20,
                  padding: "18px 16px",
                  background: "transparent",
                  border: "none",
                  borderTop: "1px solid var(--rule)",
                  cursor: "pointer",
                  textDecoration: "none",
                  color: "var(--ink)",
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--r-sm)",
                    background: "var(--paper-2)",
                    border: "1px solid var(--rule)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-2)",
                  }}
                >
                  <Icon name="file-text" size={16} />
                </span>
                <span
                  className="serif"
                  style={{ fontSize: 18, color: "var(--ink)" }}
                >
                  {s.title}
                </span>
                <span style={{ display: "flex" }}>
                  {ps.slice(0, 5).map((p, i) => (
                    <span
                      key={p.id}
                      style={{ marginLeft: i === 0 ? 0 : -6 }}
                    >
                      <Avatar
                        persona={p as unknown as PersonaVisual}
                        size={22}
                        withGlyph={false}
                      />
                    </span>
                  ))}
                </span>
                <span
                  className="mono"
                  style={{ textAlign: "right" }}
                >
                  {formatDate(s.createdAt)}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
