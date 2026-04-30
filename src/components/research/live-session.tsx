"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  EmotionChip,
  Eyebrow,
  Icon,
  type PersonaVisual,
  personaShortName,
  personaTitle,
} from "@/components/research/primitives";
import {
  useStreamStore,
  type ReportStreamState,
  type ResponseStreamState,
  type SessionStreamState,
  type TurnStreamState,
} from "@/stores/stream-store";
import type { PersonaDef } from "@/config/personas";

type Mode = "one_on_one" | "group";

interface QuestionGroup {
  questionText: string;
  orderIndex: number;
  responses: Array<{
    response: ResponseStreamState;
    sessionId: string;
    turnId: string;
  }>;
}

function fmtElapsed(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildQuestionGroups(
  sessions: SessionStreamState[],
): QuestionGroup[] {
  const groups = new Map<number, QuestionGroup>();
  for (const session of sessions) {
    for (const turn of session.turns) {
      const existing = groups.get(turn.orderIndex);
      const target =
        existing ??
        ({
          questionText: turn.questionText,
          orderIndex: turn.orderIndex,
          responses: [],
        } as QuestionGroup);
      for (const r of turn.responses) {
        target.responses.push({
          response: r,
          sessionId: session.sessionId,
          turnId: turn.turnId,
        });
      }
      if (!existing) groups.set(turn.orderIndex, target);
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
}

function findTurnSynthesis(
  sessions: SessionStreamState[],
  turnId: string,
): TurnStreamState["synthesis"] | undefined {
  for (const session of sessions) {
    const turn = session.turns.find((t) => t.turnId === turnId);
    if (turn?.synthesis) return turn.synthesis;
  }
  return undefined;
}

function TranscriptTurn({
  response,
  persona,
  followUpPrompt,
}: {
  response: ResponseStreamState;
  persona: PersonaVisual;
  followUpPrompt?: string;
}) {
  const isFollow = response.kind === "follow_up";
  return (
    <div
      className="msg-in"
      style={{
        display: "flex",
        gap: 16,
        marginLeft: isFollow ? 56 : 0,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar
          persona={persona}
          size={isFollow ? 32 : 40}
          withGlyph={!isFollow}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "var(--ink)",
              fontWeight: 500,
            }}
          >
            {personaShortName(persona)}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            {personaTitle(persona)}
          </span>
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: 999,
              background: "var(--ink-4)",
              display: "inline-block",
            }}
          />
          <span className="mono" style={{ fontSize: 10 }}>
            {isFollow ? "follow-up" : "initial"}
          </span>
          <EmotionChip emotion={response.sentiment ?? "neutral"} />
        </div>
        {isFollow && followUpPrompt && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              marginBottom: 10,
              padding: "8px 12px",
              background: "var(--paper-2)",
              borderLeft: "2px solid var(--ink-3)",
              borderRadius: "0 var(--r-sm) var(--r-sm) 0",
            }}
          >
            <Icon
              name="corner-down-right"
              size={15}
              style={{ color: "var(--ink-3)", marginTop: 4 }}
            />
            <span
              style={{
                fontSize: 15,
                fontStyle: "italic",
                fontFamily: "var(--font-display)",
                color: "var(--ink-2)",
                lineHeight: 1.55,
              }}
            >
              {followUpPrompt}
            </span>
          </div>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 15.5,
            color: "var(--ink-2)",
            lineHeight: 1.65,
            textWrap: "pretty",
            whiteSpace: "pre-wrap",
          }}
        >
          {response.spoken}
        </p>
      </div>
    </div>
  );
}

function SynthesisCard({
  synthesis,
  onNext,
  onFinish,
}: {
  synthesis: NonNullable<TurnStreamState["synthesis"]>;
  onNext: (() => void) | null;
  onFinish: (() => void) | null;
}) {
  return (
    <div
      className="msg-in"
      style={{
        marginTop: 32,
        padding: 24,
        background: "var(--card)",
        border: "1px solid var(--rule-strong)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "var(--ink)",
            color: "var(--paper)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="sparkles" size={14} />
        </span>
        <Eyebrow>Question synthesis</Eyebrow>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--ink)",
          fontFamily: "var(--font-display)",
          fontWeight: 400,
        }}
      >
        {synthesis.summary}
      </p>
      {synthesis.keyPoints.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            color: "var(--ink-2)",
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
        >
          {synthesis.keyPoints.map((kp, i) => (
            <li key={i}>{kp.point}</li>
          ))}
        </ul>
      )}
      {(onNext || onFinish) && (
        <>
          <hr className="rule" />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            {onNext && (
              <Button
                variant="primary"
                trailingIcon="arrow-right"
                onClick={onNext}
              >
                Next question
              </Button>
            )}
            {onFinish && (
              <Button
                variant="primary"
                trailingIcon="flag"
                onClick={onFinish}
              >
                Finish &amp; generate report
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PersonaSignalRow({
  persona,
  counts,
}: {
  persona: PersonaVisual;
  counts: Record<string, number>;
}) {
  const total =
    (counts.positive || 0) +
    (counts.delighted || 0) +
    (counts.neutral || 0) +
    (counts.frustrated || 0) +
    (counts.skeptical || 0) +
    (counts.confused || 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar persona={persona} size={28} withGlyph={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink)" }}>
          {personaShortName(persona)}
        </div>
        <div
          style={{
            display: "flex",
            height: 5,
            borderRadius: 999,
            overflow: "hidden",
            marginTop: 4,
            background: "var(--paper-3)",
          }}
        >
          {total > 0 ? (
            <>
              <span
                style={{
                  flex:
                    (counts.positive || 0) + (counts.delighted || 0),
                  background: "var(--emo-positive)",
                }}
              />
              <span
                style={{
                  flex: counts.neutral || 0,
                  background: "var(--emo-neutral)",
                }}
              />
              <span
                style={{
                  flex: counts.skeptical || 0,
                  background: "var(--emo-skeptical)",
                }}
              />
              <span
                style={{
                  flex: counts.frustrated || 0,
                  background: "var(--emo-frustrated)",
                }}
              />
              <span
                style={{
                  flex: counts.confused || 0,
                  background: "var(--emo-confused)",
                }}
              />
            </>
          ) : null}
        </div>
      </div>
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--ink-3)",
          minWidth: 18,
          textAlign: "right",
        }}
      >
        {total || "–"}
      </span>
    </div>
  );
}

function PausedNotice() {
  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: "var(--r)",
        background: "var(--paper-2)",
        border: "1px dashed var(--rule-strong)",
        color: "var(--ink-3)",
        fontSize: 13.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Icon name="pause" size={14} /> Stream paused. The next persona will
      resume on play.
    </div>
  );
}

export function LiveSession({ studyId }: { studyId: string }) {
  const router = useRouter();
  const { sessions, report, studyComplete, error, apply, reset, hydrate } =
    useStreamStore();
  const [reconnectKey, setReconnectKey] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [study, setStudy] = useState<{
    title: string;
    sessionMode: Mode;
    selectedPersonaIds: string[];
    questionCount: number;
    status: string;
  } | null>(null);
  const [personas, setPersonas] = useState<PersonaDef[]>([]);
  const [activeQ, setActiveQ] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const isLiveStudy = study
    ? study.status !== "completed" && study.status !== "interrupted"
    : true;

  // Bootstrap study + personas
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/studies/${studyId}`),
        fetch("/api/personas"),
      ]);
      if (cancelled) return;
      if (sRes.ok) {
        const d = await sRes.json();
        const config = d.study.config
          ? (JSON.parse(d.study.config) as {
              selectedPersonaIds?: string[];
            })
          : { selectedPersonaIds: [] };
        setStudy({
          title: d.study.title,
          sessionMode: d.study.sessionMode,
          selectedPersonaIds: config.selectedPersonaIds ?? [],
          questionCount: d.questions.length,
          status: d.study.status,
        });
      }
      if (pRes.ok) setPersonas(await pRes.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  // For completed/interrupted studies, hydrate from the persisted transcript;
  // otherwise open the SSE stream.
  useEffect(() => {
    if (!study) return;
    if (isLiveStudy) {
      reset();
      const es = new EventSource(
        `/api/studies/${studyId}/status?stream=1`,
      );
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          apply(evt);
        } catch {
          /* heartbeat */
        }
      };
      es.onerror = () => {
        es.close();
      };
      return () => es.close();
    }
    let cancelled = false;
    void (async () => {
      reset();
      const res = await fetch(`/api/studies/${studyId}/transcript`);
      if (cancelled || !res.ok) return;
      const data = (await res.json()) as {
        sessions: SessionStreamState[];
        report: ReportStreamState | null;
        studyComplete: boolean;
      };
      hydrate({
        sessions: data.sessions,
        report: data.report,
        studyComplete: data.studyComplete,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId, isLiveStudy, study, apply, reset, hydrate, reconnectKey]);

  // Tick clock
  useEffect(() => {
    if (paused || studyComplete) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused, studyComplete]);

  const sessionList = useMemo(
    () =>
      Object.values(sessions).sort((a, b) =>
        a.sessionId.localeCompare(b.sessionId),
      ),
    [sessions],
  );

  const personasById = useMemo(
    () => Object.fromEntries(personas.map((p) => [p.id, p])),
    [personas],
  );

  const questionGroups = useMemo(
    () => buildQuestionGroups(sessionList),
    [sessionList],
  );

  // Auto-advance to the latest question that has any responses
  useEffect(() => {
    if (questionGroups.length === 0) return;
    setActiveQ((curr) => {
      const max = questionGroups.length - 1;
      return curr > max ? max : curr;
    });
  }, [questionGroups.length]);

  // Aggregate emotion counts per persona, up to and including the active question
  const emotionCounts = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (let i = 0; i <= activeQ && i < questionGroups.length; i++) {
      for (const item of questionGroups[i].responses) {
        const pid = item.response.personaId;
        out[pid] ??= {};
        const emotion = (item.response.sentiment ?? "neutral") as string;
        out[pid][emotion] = (out[pid][emotion] || 0) + 1;
      }
    }
    return out;
  }, [questionGroups, activeQ]);

  const restart = useCallback(async () => {
    setRestarting(true);
    try {
      const res = await fetch(`/api/studies/${studyId}/restart`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Restart failed");
      }
      toast.success("Restarted");
      reset();
      setReconnectKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restart failed");
    } finally {
      setRestarting(false);
    }
  }, [studyId, reset]);

  const finishStudy = useCallback(() => {
    router.push(`/study/${studyId}/report`);
  }, [router, studyId]);

  if (!study) {
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

  const totalQ = study.questionCount || questionGroups.length || 1;
  const currentGroup = questionGroups[activeQ];
  const interrupted = Boolean(error);
  const synthesis = currentGroup
    ? findTurnSynthesis(sessionList, currentGroup.responses[0]?.turnId ?? "")
    : undefined;

  // Build follow-up prompts lookup keyed by parentResponseId
  const followUpPrompts = new Map<string, string>();
  for (const session of sessionList) {
    for (const turn of session.turns) {
      for (const fu of turn.followUps) {
        followUpPrompts.set(fu.parentResponseId, fu.question);
      }
    }
  }

  const allParticipantPersonas = study.selectedPersonaIds
    .map((id) => personasById[id])
    .filter(Boolean) as PersonaDef[];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 340px",
        minHeight: "calc(100vh - 0px)",
      }}
    >
      <section
        style={{
          borderRight: "1px solid var(--rule)",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Sticky header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "14px 24px",
            borderBottom: "1px solid var(--rule)",
            background: "var(--paper)",
            position: "sticky",
            top: 0,
            zIndex: 4,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
              flex: "1 1 320px",
            }}
          >
            <button
              type="button"
              onClick={() => router.push(`/study/${studyId}`)}
              className="btn btn-ghost btn-sm"
              style={{
                padding: "4px 10px",
                flexShrink: 0,
                gap: 6,
              }}
              title="Back to study summary"
            >
              <Icon name="arrow-left" size={14} /> Summary
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span className="rec-dot" />
              <span
                className="mono"
                style={{ color: "var(--signal)" }}
              >
                {paused
                  ? "paused"
                  : studyComplete
                    ? "complete"
                    : "live"}
              </span>
            </div>
            <span
              style={{
                width: 1,
                height: 20,
                background: "var(--rule)",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15,
                minWidth: 0,
                flex: 1,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: "var(--ink)",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {study.title}
              </span>
              <span className="mono" style={{ fontSize: 10 }}>
                question {Math.min(activeQ + 1, totalQ)} of {totalQ} ·{" "}
                {study.sessionMode === "group" ? "group" : "1-on-1"}
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 13,
                color: "var(--ink-2)",
                padding: "4px 10px",
                background: "var(--paper-2)",
                borderRadius: "var(--r)",
                border: "1px solid var(--rule)",
              }}
            >
              {fmtElapsed(elapsed)}
            </span>
            {!studyComplete && (
              <Button
                size="sm"
                variant="ghost"
                icon={paused ? "play" : "pause"}
                onClick={() => setPaused((p) => !p)}
                title={paused ? "Resume" : "Pause"}
                ariaLabel={paused ? "Resume" : "Pause"}
              >
                {""}
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              icon="flag"
              onClick={finishStudy}
            >
              End
            </Button>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px 48px 200px",
            maxWidth: 880,
            width: "100%",
          }}
        >
          {interrupted && (
            <div
              className="card"
              style={{
                padding: 16,
                marginBottom: 24,
                borderColor: "var(--signal-line)",
                background: "var(--signal-soft)",
                color: "var(--ink)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Icon
                  name="alert-triangle"
                  size={16}
                  style={{ color: "var(--signal)" }}
                />
                <span
                  className="mono"
                  style={{ color: "var(--signal)", fontSize: 11 }}
                >
                  run interrupted
                </span>
              </div>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13.5,
                  color: "var(--ink-2)",
                  lineHeight: 1.55,
                }}
              >
                {error}. The most common cause is the dev server reloading
                mid-run. Restart from scratch to retry.
              </p>
              <Button
                size="sm"
                variant="signal"
                icon="rotate-ccw"
                onClick={restart}
                disabled={restarting}
              >
                {restarting ? "Restarting…" : "Restart from scratch"}
              </Button>
            </div>
          )}

          {questionGroups.length === 0 && !interrupted ? (
            <div
              style={{
                padding: 80,
                textAlign: "center",
                color: "var(--ink-3)",
                fontSize: 14,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: "2px solid var(--rule)",
                  borderTopColor: "var(--ink)",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                  marginBottom: 12,
                }}
              />
              <div>Waiting for the first session to start…</div>
            </div>
          ) : currentGroup ? (
            <>
              {/* Question banner */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <Eyebrow>
                    Question{" "}
                    {String(activeQ + 1).padStart(2, "0")}
                  </Eyebrow>
                  <span
                    style={{
                      height: 1,
                      flex: 1,
                      background: "var(--rule)",
                    }}
                  />
                  <span
                    className="mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Icon
                      name={
                        study.sessionMode === "group" ? "users" : "user"
                      }
                      size={12}
                    />{" "}
                    {study.sessionMode === "group" ? "group" : "1-on-1"}
                  </span>
                </div>
                <h2
                  className="serif"
                  style={{
                    fontSize: 32,
                    fontWeight: 400,
                    lineHeight: 1.2,
                    margin: "0 0 18px",
                    color: "var(--ink)",
                    maxWidth: 720,
                  }}
                >
                  {currentGroup.questionText}
                </h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="mono" style={{ fontSize: 10 }}>
                    asked of
                  </span>
                  {allParticipantPersonas.map((p) => (
                    <span
                      key={p.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 10px 3px 3px",
                        background: "var(--paper-2)",
                        borderRadius: 999,
                        border: "1px solid var(--rule)",
                      }}
                    >
                      <Avatar
                        persona={p as unknown as PersonaVisual}
                        size={18}
                        withGlyph={false}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--ink-2)",
                        }}
                      >
                        {personaShortName(p as unknown as PersonaVisual)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Turns */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 28,
                  marginTop: 32,
                }}
              >
                {paused && currentGroup.responses.length === 0 && (
                  <PausedNotice />
                )}
                {currentGroup.responses.map(({ response }) => {
                  const persona = personasById[response.personaId];
                  if (!persona) return null;
                  return (
                    <TranscriptTurn
                      key={response.responseId}
                      response={response}
                      persona={persona as unknown as PersonaVisual}
                      followUpPrompt={
                        response.kind === "follow_up"
                          ? followUpPrompts.get(response.responseId) ??
                            response.questionAsked
                          : undefined
                      }
                    />
                  );
                })}
              </div>

              {synthesis && (
                <SynthesisCard
                  synthesis={synthesis}
                  onNext={
                    activeQ < questionGroups.length - 1
                      ? () => setActiveQ(activeQ + 1)
                      : null
                  }
                  onFinish={
                    activeQ === questionGroups.length - 1 &&
                    studyComplete
                      ? finishStudy
                      : null
                  }
                />
              )}
            </>
          ) : null}

          {studyComplete && report && !synthesis && (
            <div
              className="card"
              style={{
                marginTop: 32,
                padding: 24,
                borderColor: "var(--rule-strong)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "var(--ink)",
                    color: "var(--paper)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="check" size={14} stroke={2} />
                </span>
                <Eyebrow>Study complete</Eyebrow>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: "var(--ink)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {report.executiveSummary}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  variant="primary"
                  trailingIcon="arrow-right"
                  onClick={finishStudy}
                >
                  Open full report
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SIDE: live signal */}
      <aside
        style={{
          background: "var(--paper-2)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <Eyebrow>Plan</Eyebrow>
          {questionGroups.length === 0 ? (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--ink-3)",
                margin: "12px 0 0",
              }}
            >
              Plan loads as personas begin answering.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginTop: 12,
              }}
            >
              {questionGroups.map((q, i) => {
                const active = i === activeQ;
                const done = i < activeQ;
                return (
                  <button
                    key={q.orderIndex}
                    type="button"
                    onClick={() => setActiveQ(i)}
                    style={{
                      textAlign: "left",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "8px 10px",
                      background: active ? "var(--card)" : "transparent",
                      border: "1px solid",
                      borderColor: active
                        ? "var(--rule-strong)"
                        : "transparent",
                      borderRadius: "var(--r-sm)",
                      cursor: "pointer",
                      transition: "all var(--dur) var(--ease)",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        flexShrink: 0,
                        border: `1px solid ${
                          active || done
                            ? "var(--ink)"
                            : "var(--rule-strong)"
                        }`,
                        background: done ? "var(--ink)" : "transparent",
                        color: done ? "var(--paper)" : "var(--ink-3)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 9.5,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 2,
                      }}
                    >
                      {done ? (
                        <Icon name="check" size={9} stroke={2} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: active ? "var(--ink)" : "var(--ink-2)",
                        lineHeight: 1.4,
                        textWrap: "pretty",
                      }}
                    >
                      {q.questionText}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <Eyebrow>Emotional signal</Eyebrow>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 14,
            }}
          >
            {allParticipantPersonas.map((p) => (
              <PersonaSignalRow
                key={p.id}
                persona={p as unknown as PersonaVisual}
                counts={emotionCounts[p.id] ?? {}}
              />
            ))}
            {allParticipantPersonas.length === 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  margin: 0,
                }}
              >
                No personas selected.
              </p>
            )}
          </div>
        </div>

      </aside>
    </div>
  );
}
