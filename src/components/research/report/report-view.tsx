"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Eyebrow,
  Icon,
  type PersonaVisual,
  personaShortName,
  personaTitle,
} from "@/components/research/primitives";
import { PdfExportButton } from "@/components/research/pdf-export-button";
import type {
  ReportFinding,
  ReportRecommendation,
  ReportTheme,
  PerPersonaFinding,
} from "@/lib/agents/schemas/research/synthesis";
import type { PersonaDef } from "@/config/personas";
import { ReportMarkdown } from "@/components/research/report/section";

interface SectionRow {
  id: string;
  sectionKey:
    | "executive_summary"
    | "key_findings"
    | "themes"
    | "per_persona"
    | "recommendations"
    | "open_questions";
  orderIndex: number;
  content: string;
  structuredOutput: string | null;
}

interface StudyMeta {
  title: string;
  problemStatement: string;
  sessionMode: "one_on_one" | "group";
  selectedPersonaIds: string[];
  questionCount: number;
}

function sectionParse<T>(s: SectionRow): T | null {
  if (!s.structuredOutput) return null;
  try {
    return JSON.parse(s.structuredOutput) as T;
  } catch {
    return null;
  }
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 56 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <span className="mono" style={{ fontSize: 11 }}>
          {number}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          {title}
        </span>
        <span
          style={{ flex: 1, height: 1, background: "var(--rule)" }}
        />
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <span className="mono" style={{ fontSize: 10 }}>
        {label}
      </span>
      <span
        className="serif"
        style={{ fontSize: 24, color: "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function ReportView({ studyId }: { studyId: string }) {
  const router = useRouter();
  const [sections, setSections] = useState<SectionRow[] | null>(null);
  const [study, setStudy] = useState<StudyMeta | null>(null);
  const [personas, setPersonas] = useState<PersonaDef[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [secRes, sRes, pRes] = await Promise.all([
        fetch(`/api/studies/${studyId}/report`),
        fetch(`/api/studies/${studyId}`),
        fetch("/api/personas"),
      ]);
      if (cancelled) return;
      if (secRes.ok) setSections(await secRes.json());
      if (sRes.ok) {
        const d = await sRes.json();
        const config = d.study.config
          ? (JSON.parse(d.study.config) as {
              selectedPersonaIds?: string[];
            })
          : { selectedPersonaIds: [] };
        setStudy({
          title: d.study.title,
          problemStatement: d.study.problemStatement,
          sessionMode: d.study.sessionMode,
          selectedPersonaIds: config.selectedPersonaIds ?? [],
          questionCount: d.questions.length,
        });
      }
      if (pRes.ok) setPersonas(await pRes.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  const personasById = useMemo(
    () => Object.fromEntries(personas.map((p) => [p.id, p])),
    [personas],
  );

  if (!sections || !study) {
    return (
      <div
        style={{
          padding: "32px 48px",
          color: "var(--ink-3)",
        }}
      >
        <Eyebrow>loading</Eyebrow>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div
        style={{
          padding: "80px 48px",
          textAlign: "center",
          color: "var(--ink-3)",
        }}
      >
        <p style={{ marginBottom: 16, fontSize: 14 }}>
          No report yet. Run the study to generate one.
        </p>
        <Button
          variant="secondary"
          icon="arrow-left"
          onClick={() => router.push(`/study/${studyId}`)}
        >
          Back to study
        </Button>
      </div>
    );
  }

  const sectionByKey = Object.fromEntries(
    sections.map((s) => [s.sectionKey, s] as const),
  );
  const summarySection = sectionByKey["executive_summary"];
  const themes =
    sectionParse<ReportTheme[]>(sectionByKey["themes"]) ?? [];
  const findings =
    sectionParse<ReportFinding[]>(sectionByKey["key_findings"]) ?? [];
  const perPersona =
    sectionParse<PerPersonaFinding[]>(sectionByKey["per_persona"]) ?? [];
  const recommendations =
    sectionParse<ReportRecommendation[]>(
      sectionByKey["recommendations"],
    ) ?? [];
  const openQuestions =
    sectionParse<string[]>(sectionByKey["open_questions"]) ?? [];

  const participants = study.selectedPersonaIds.length;

  // Estimate theme weights — even split if not provided in payload.
  const themesWithWeight = themes.map((t, i) => ({
    ...t,
    weight: 1 / Math.max(themes.length, 1) * (1 + (themes.length - i) * 0.04),
  }));
  const totalWeight =
    themesWithWeight.reduce((acc, t) => acc + t.weight, 0) || 1;
  const themesNormalized = themesWithWeight.map((t) => ({
    ...t,
    weight: t.weight / totalWeight,
  }));

  return (
    <div>
      {/* Top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 32px",
          borderBottom: "1px solid var(--rule)",
          position: "sticky",
          top: 0,
          background: "var(--paper)",
          zIndex: 4,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={() => router.push(`/study/${studyId}`)}
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 10px", gap: 6 }}
            title="Back to study summary"
          >
            <Icon name="arrow-left" size={14} /> Summary
          </button>
          <Eyebrow>Report · {studyId.slice(0, 8).toUpperCase()}</Eyebrow>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          <Button
            size="sm"
            variant="secondary"
            icon="copy"
            onClick={() => {
              if (summarySection) {
                navigator.clipboard.writeText(summarySection.content);
                toast.success("Summary copied");
              }
            }}
          >
            Copy summary
          </Button>
          <PdfExportButton
            targetId="report-content"
            fileName={`research-report-${studyId}.pdf`}
          />
        </div>
      </header>

      {/* Page */}
      <div
        id="report-content"
        style={{
          maxWidth: 940,
          margin: "0 auto",
          padding: "56px 48px 120px",
        }}
      >
        {/* Cover */}
        <Eyebrow>Research report</Eyebrow>
        <h1
          className="display"
          style={{
            fontSize: 56,
            margin: "14px 0 20px",
            maxWidth: 800,
          }}
        >
          {study.title}
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: "var(--ink-3)",
            maxWidth: 720,
            margin: "0 0 36px",
            fontFamily: "var(--font-display)",
            whiteSpace: "pre-wrap",
          }}
        >
          {study.problemStatement}
        </p>

        {/* Run stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            padding: "20px 0",
            borderTop: "1px solid var(--rule-strong)",
            borderBottom: "1px solid var(--rule-strong)",
            marginBottom: 56,
          }}
        >
          <Stat
            label="Mode"
            value={
              study.sessionMode === "group" ? "Group" : "1-on-1"
            }
          />
          <Stat label="Personas" value={participants} />
          <Stat label="Questions" value={study.questionCount} />
          <Stat
            label="Findings"
            value={findings.length || sections.length}
          />
        </div>

        {/* Executive summary */}
        {summarySection && (
          <Section number="01" title="Executive summary">
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.7,
                color: "var(--ink)",
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                textWrap: "pretty",
                whiteSpace: "pre-wrap",
              }}
            >
              {summarySection.content}
            </p>
          </Section>
        )}

        {/* Themes */}
        {themesNormalized.length > 0 && (
          <Section number="02" title="Themes">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {themesNormalized.map((th, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 220px 1fr 60px",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: "var(--ink-4)" }}
                  >
                    0{i + 1}
                  </span>
                  <span
                    style={{ fontSize: 15, color: "var(--ink)" }}
                  >
                    {th.name}
                  </span>
                  <span
                    style={{
                      height: 6,
                      background: "var(--paper-3)",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${Math.round(th.weight * 100)}%`,
                        background: "var(--ink)",
                        transition: "width 320ms var(--ease)",
                      }}
                    />
                  </span>
                  <span
                    className="mono"
                    style={{ textAlign: "right" }}
                  >
                    {Math.round(th.weight * 100)}%
                  </span>
                </div>
              ))}
              {themes.some(
                (t) => t.supportingQuotes && t.supportingQuotes.length > 0,
              ) && (
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {themes.map((t, i) =>
                    t.supportingQuotes && t.supportingQuotes.length > 0 ? (
                      <div
                        key={i}
                        style={{
                          paddingLeft: 16,
                          borderLeft: "2px solid var(--rule-strong)",
                        }}
                      >
                        <div
                          className="mono"
                          style={{ fontSize: 10, marginBottom: 6 }}
                        >
                          0{i + 1} · {t.name}
                        </div>
                        <ul
                          style={{
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {t.supportingQuotes.map((q, j) => (
                            <li
                              key={j}
                              style={{
                                fontFamily: "var(--font-display)",
                                fontStyle: "italic",
                                fontSize: 14,
                                color: "var(--ink-2)",
                                lineHeight: 1.55,
                              }}
                            >
                              &ldquo;{q.quote}&rdquo;{" "}
                              <span
                                className="mono"
                                style={{
                                  fontStyle: "normal",
                                  fontSize: 10,
                                }}
                              >
                                — {q.personaId}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Key findings */}
        {findings.length > 0 && (
          <Section number="03" title="Key findings">
            <div
              style={{ display: "flex", flexDirection: "column" }}
            >
              {findings.map((f, i) => (
                <article
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 100px",
                    gap: 24,
                    padding: "20px 0",
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--rule)",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-4)" }}
                  >
                    F.{String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15.5,
                        color: "var(--ink)",
                        lineHeight: 1.55,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {f.finding}
                    </p>
                    {f.contributingPersonaIds.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {f.contributingPersonaIds.map((id) => {
                          const p = personasById[id];
                          if (!p) return null;
                          return (
                            <span
                              key={id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Avatar
                                persona={p as unknown as PersonaVisual}
                                size={16}
                                withGlyph={false}
                              />
                              <span
                                className="mono"
                                style={{ fontSize: 10 }}
                              >
                                {personaShortName(
                                  p as unknown as PersonaVisual,
                                )}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "var(--ink-3)",
                      textAlign: "right",
                    }}
                  >
                    {f.evidenceStrength}
                  </span>
                </article>
              ))}
            </div>
          </Section>
        )}

        {/* Per-persona */}
        {perPersona.length > 0 && (
          <Section number="04" title="Per-persona findings">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 16,
              }}
            >
              {perPersona.map((pp) => {
                const persona = personasById[pp.personaId];
                if (!persona) return null;
                return (
                  <div
                    key={pp.personaId}
                    className="card"
                    style={{
                      padding: 20,
                      display: "grid",
                      gridTemplateColumns: "60px 1fr",
                      gap: 20,
                      alignItems: "flex-start",
                    }}
                  >
                    <Avatar
                      persona={persona as unknown as PersonaVisual}
                      size={48}
                    />
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          marginBottom: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className="serif"
                          style={{
                            fontSize: 19,
                            color: "var(--ink)",
                          }}
                        >
                          {pp.personaName ||
                            personaShortName(
                              persona as unknown as PersonaVisual,
                            )}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "var(--ink-3)",
                          }}
                        >
                          {personaTitle(
                            persona as unknown as PersonaVisual,
                          )}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          color: "var(--ink-2)",
                          lineHeight: 1.6,
                        }}
                      >
                        {pp.distinctive}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Section number="05" title="Recommendations">
            <div
              style={{ display: "flex", flexDirection: "column" }}
            >
              {recommendations.map((rec, i) => (
                <article
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 100px",
                    gap: 24,
                    padding: "18px 0",
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--rule)",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-4)" }}
                  >
                    R.{String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        color: "var(--ink)",
                        lineHeight: 1.55,
                      }}
                    >
                      {rec.action}
                    </p>
                  </div>
                  <span
                    className="pill"
                    style={{
                      alignSelf: "flex-start",
                      background:
                        rec.priority === "high"
                          ? "var(--emo-frustrated-bg)"
                          : "var(--paper-2)",
                      color:
                        rec.priority === "high"
                          ? "var(--emo-frustrated)"
                          : "var(--ink-2)",
                      borderColor: "var(--rule)",
                      justifySelf: "flex-end",
                    }}
                  >
                    {rec.priority}
                  </span>
                </article>
              ))}
            </div>
          </Section>
        )}

        {/* Open questions */}
        {openQuestions.length > 0 && (
          <Section number="06" title="Open questions">
            <ol
              style={{
                margin: 0,
                paddingLeft: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {openQuestions.map((q, i) => (
                <li
                  key={i}
                  style={{ display: "flex", gap: 14 }}
                >
                  <span
                    className="mono"
                    style={{
                      color: "var(--ink-4)",
                      minWidth: 24,
                    }}
                  >
                    ?{i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: "var(--ink-2)",
                      fontFamily: "var(--font-display)",
                      lineHeight: 1.55,
                      fontStyle: "italic",
                    }}
                  >
                    {q}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Markdown fallback for any sections without structured output */}
        {sections
          .filter(
            (s) =>
              !s.structuredOutput &&
              s.sectionKey !== "executive_summary",
          )
          .map((s) => (
            <Section
              key={s.id}
              number={String(s.orderIndex + 1).padStart(2, "0")}
              title={s.sectionKey.replace(/_/g, " ")}
            >
              <ReportMarkdown content={s.content} />
            </Section>
          ))}

        {/* End mark */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 80,
          }}
        >
          <span
            style={{
              width: 40,
              height: 1,
              background: "var(--rule-strong)",
              display: "inline-block",
            }}
          />
        </div>
      </div>
    </div>
  );
}
