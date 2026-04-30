"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FlaskConical,
  UsersRound,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface RouteDef {
  href: string;
  label: string;
  Icon: LucideIcon;
  match: (path: string) => boolean;
}

const ROUTES: RouteDef[] = [
  {
    href: "/",
    label: "Studies",
    Icon: FlaskConical,
    match: (p) =>
      p === "/" ||
      p.startsWith("/studies") ||
      p.startsWith("/study"),
  },
  {
    href: "/personas",
    label: "Personas",
    Icon: UsersRound,
    match: (p) => p.startsWith("/personas"),
  },
  {
    href: "/reports",
    label: "Reports",
    Icon: FileText,
    match: (p) => p.startsWith("/reports"),
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: Settings,
    match: (p) => p.startsWith("/settings"),
  },
];

interface ActiveStudy {
  id: string;
  title: string;
  questionsTotal: number | null;
  currentQuestion: number | null;
  sessionMode: "one_on_one" | "group";
}

function ActiveStudyCard() {
  const [study, setStudy] = useState<ActiveStudy | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/studies");
        if (!res.ok) return;
        const all = (await res.json()) as Array<{
          id: string;
          title: string;
          status: string;
        }>;
        const running = all.find((s) => s.status === "running");
        if (!running) {
          if (!cancelled) setStudy(null);
          return;
        }
        const detailRes = await fetch(`/api/studies/${running.id}`);
        if (!detailRes.ok) return;
        const detail = await detailRes.json();
        if (cancelled) return;
        setStudy({
          id: running.id,
          title: running.title,
          questionsTotal: detail.questions?.length ?? null,
          currentQuestion: null,
          sessionMode: detail.study.sessionMode,
        });
      } catch {
        /* ignore */
      }
    };
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!study) return null;
  const modeLabel = study.sessionMode === "group" ? "group" : "1-on-1";
  return (
    <Link
      href={`/study/${study.id}/run`}
      style={{
        textAlign: "left",
        padding: "10px 12px",
        background: "var(--card)",
        border: "1px solid var(--signal-line)",
        borderRadius: "var(--r)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        textDecoration: "none",
        color: "var(--ink)",
        transition: "all var(--dur) var(--ease)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="rec-dot" />
        <span
          className="mono"
          style={{ color: "var(--signal)", fontSize: 10 }}
        >
          live now
        </span>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink)",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {study.title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {study.questionsTotal !== null
          ? `${study.questionsTotal} questions`
          : "preparing"}{" "}
        · {modeLabel}
      </div>
    </Link>
  );
}

function Sidebar() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/login")) return null;
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid var(--rule)",
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        background: "var(--paper)",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      {/* Wordmark */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 6px",
          textDecoration: "none",
          color: "var(--ink)",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--ink)",
            color: "var(--paper)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 400,
            fontStyle: "italic",
            letterSpacing: "-0.02em",
          }}
        >
          R
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.05,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              color: "var(--ink)",
            }}
          >
            Research{" "}
            <span className="italic-serif" style={{ color: "var(--ink-3)" }}>
              AI
            </span>
          </span>
          <span
            className="mono"
            style={{ fontSize: 9.5, color: "var(--ink-4)" }}
          >
            v0.4 · workspace
          </span>
        </div>
      </Link>

      {/* Primary nav */}
      <nav
        style={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {ROUTES.map((r) => {
          const active = r.match(pathname);
          const { Icon } = r;
          return (
            <Link
              key={r.href}
              href={r.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: active ? "var(--paper-2)" : "transparent",
                border: "1px solid",
                borderColor: active ? "var(--rule)" : "transparent",
                borderRadius: "var(--r)",
                color: active ? "var(--ink)" : "var(--ink-2)",
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: active ? 500 : 400,
                cursor: "pointer",
                textDecoration: "none",
                textAlign: "left",
                transition: "all var(--dur) var(--ease)",
              }}
            >
              <Icon size={16} strokeWidth={1.5} />
              {r.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <ActiveStudyCard />
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  // Login page renders bare — no sidebar
  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
