"use client";

import {
  type CSSProperties,
  type ComponentType,
  type ReactNode,
  type SVGProps,
  createElement,
  forwardRef,
} from "react";
import * as Lucide from "lucide-react";

/* ============================================================
   Icon — light wrapper around lucide-react keyed by kebab name.
   ============================================================ */

type LucideIconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const PASCAL_CACHE: Record<string, LucideIconType | undefined> = {};

function pascal(name: string) {
  return name
    .split(/[-_]/)
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join("");
}

function getIcon(name: string): LucideIconType | null {
  if (PASCAL_CACHE[name]) return PASCAL_CACHE[name] ?? null;
  const key = pascal(name);
  // lucide-react exports each icon as a component named in PascalCase.
  const cmp = (Lucide as unknown as Record<string, LucideIconType | undefined>)[key];
  if (cmp) PASCAL_CACHE[name] = cmp;
  return cmp ?? null;
}

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 16,
  stroke = 1.5,
  className,
  style,
}: IconProps) {
  const cmp = getIcon(name);
  if (!cmp) return null;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {createElement(cmp, {
        width: size,
        height: size,
        strokeWidth: stroke,
      })}
    </span>
  );
}

/* ============================================================
   Persona visuals
   ============================================================ */

export interface PersonaVisual {
  id: string;
  name: string;
  shortName?: string;
  title?: string;
  initials?: string;
  hue?: number;
  chroma?: number;
  glyph?: string;
  blurb?: string;
  description?: string;
  techComfort?: "low" | "medium" | "high";
  tech?: "low" | "medium" | "high";
  goals?: string[];
  pains?: string[];
  painPoints?: string[];
  traits?: string[];
  behaviouralTraits?: string[];
  style?: string;
  communicationStyle?: string;
  age?: number | string;
  demographics?: { age?: string };
}

export function deriveInitials(p: PersonaVisual): string {
  if (p.initials) return p.initials;
  const base = p.shortName ?? p.name.split(/[ —-]/)[0] ?? p.name;
  const letters = base.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  return letters.length === 2 ? letters : (base.slice(0, 2) || "??").toUpperCase();
}

export function deriveHue(p: PersonaVisual): number {
  if (typeof p.hue === "number") return p.hue;
  // Hash the id to a stable hue 0..359 if no hue given
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function deriveChroma(p: PersonaVisual): number {
  return typeof p.chroma === "number" ? p.chroma : 0.05;
}

export function deriveGlyph(p: PersonaVisual): string {
  return p.glyph ?? "user";
}

export function personaShortName(p: PersonaVisual): string {
  return p.shortName ?? p.name.split(" — ")[0] ?? p.name;
}

export function personaTitle(p: PersonaVisual): string {
  return p.title ?? (p.name.includes(" — ") ? p.name.split(" — ")[1] : "");
}

export function personaTech(
  p: PersonaVisual,
): "low" | "medium" | "high" {
  return p.tech ?? p.techComfort ?? "medium";
}

export function personaBlurb(p: PersonaVisual): string {
  return p.blurb ?? p.description ?? "";
}

export function personaTraits(p: PersonaVisual): string[] {
  return p.traits ?? p.behaviouralTraits ?? [];
}

export function personaPains(p: PersonaVisual): string[] {
  return p.pains ?? p.painPoints ?? [];
}

export function personaStyle(p: PersonaVisual): string {
  return p.style ?? p.communicationStyle ?? "";
}

interface AvatarProps {
  persona?: PersonaVisual | null;
  size?: number;
  withGlyph?: boolean;
  ring?: boolean;
  style?: CSSProperties;
}

export function Avatar({
  persona,
  size = 40,
  withGlyph = true,
  ring = false,
  style,
}: AvatarProps) {
  if (!persona) return null;
  const hue = deriveHue(persona);
  const chroma = deriveChroma(persona);
  const initials = deriveInitials(persona);
  const glyph = deriveGlyph(persona);
  const bg = `oklch(0.86 ${chroma} ${hue})`;
  const ink = `oklch(0.32 ${Math.min(chroma + 0.04, 0.10)} ${hue})`;
  const stroke = `oklch(0.55 ${chroma} ${hue} / 0.35)`;
  const initialsSize = Math.max(10, size * 0.36);
  const glyphSize = Math.max(10, size * 0.30);
  const glyphBox = Math.max(16, size * 0.42);
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: bg,
          border: `1px solid ${stroke}`,
          boxShadow: ring
            ? `0 0 0 3px oklch(0.86 ${chroma} ${hue} / 0.25)`
            : "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: ink,
          fontFamily: "var(--font-mono)",
          fontSize: initialsSize,
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        {initials}
      </span>
      {withGlyph && (
        <span
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: glyphBox,
            height: glyphBox,
            borderRadius: "50%",
            background: "var(--card)",
            border: "1px solid var(--rule)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: ink,
          }}
        >
          <Icon name={glyph} size={glyphSize} stroke={1.6} />
        </span>
      )}
    </span>
  );
}

export function PersonaTag({
  persona,
  size = 22,
}: {
  persona: PersonaVisual;
  size?: number;
}) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <Avatar persona={persona} size={size} withGlyph={false} />
      <span
        style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}
      >
        {personaShortName(persona)}
      </span>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
        {personaTitle(persona)}
      </span>
    </span>
  );
}

/* ============================================================
   Tech badge
   ============================================================ */

export function TechBadge({ level }: { level: "low" | "medium" | "high" }) {
  const dots = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: "var(--ink-3)",
      }}
    >
      tech
      <span style={{ display: "inline-flex", gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background:
                i <= dots ? "var(--ink-2)" : "var(--paper-3)",
              border: "1px solid var(--rule)",
              display: "inline-block",
            }}
          />
        ))}
      </span>
    </span>
  );
}

/* ============================================================
   Emotion chip
   ============================================================ */

export type EmotionTone =
  | "positive"
  | "frustrated"
  | "neutral"
  | "skeptical"
  | "confused"
  | "delighted";

const EMOTION_COLORS: Record<EmotionTone, [string, string]> = {
  positive: ["var(--emo-positive)", "var(--emo-positive-bg)"],
  delighted: ["var(--emo-positive)", "var(--emo-positive-bg)"],
  frustrated: ["var(--emo-frustrated)", "var(--emo-frustrated-bg)"],
  neutral: ["var(--emo-neutral)", "var(--emo-neutral-bg)"],
  skeptical: ["var(--emo-skeptical)", "var(--emo-skeptical-bg)"],
  confused: ["var(--emo-confused)", "var(--emo-confused-bg)"],
};

export function EmotionChip({ emotion }: { emotion: string }) {
  const tone: EmotionTone = (
    Object.keys(EMOTION_COLORS) as EmotionTone[]
  ).includes(emotion as EmotionTone)
    ? (emotion as EmotionTone)
    : "neutral";
  const [fg, bg] = EMOTION_COLORS[tone];
  return (
    <span
      data-emotion={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: fg,
        background: bg,
        border: "1px solid var(--rule)",
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: fg,
          display: "inline-block",
        }}
      />
      {emotion}
    </span>
  );
}

/* ============================================================
   Pill
   ============================================================ */

interface PillProps {
  children: ReactNode;
  tone?: "neutral" | "accent" | "signal" | "soft";
  icon?: string;
  style?: CSSProperties;
}

export function Pill({ children, tone = "neutral", icon, style }: PillProps) {
  const tones = {
    neutral: {
      bg: "var(--paper-2)",
      fg: "var(--ink-2)",
      bd: "var(--rule)",
    },
    accent: {
      bg: "rgba(26,24,20,0.06)",
      fg: "var(--ink)",
      bd: "var(--rule-strong)",
    },
    signal: {
      bg: "var(--signal-soft)",
      fg: "var(--signal)",
      bd: "var(--signal-line)",
    },
    soft: {
      bg: "transparent",
      fg: "var(--ink-3)",
      bd: "var(--rule)",
    },
  } as const;
  const t = tones[tone];
  return (
    <span
      className="pill"
      style={{
        background: t.bg,
        color: t.fg,
        borderColor: t.bd,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

/* ============================================================
   Button
   ============================================================ */

interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "signal";
  size?: "sm" | "md" | "lg";
  icon?: string;
  trailingIcon?: string;
  children?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
  title?: string;
  ariaLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      icon,
      trailingIcon,
      children,
      onClick,
      disabled,
      style,
      type = "button",
      title,
      ariaLabel,
    },
    ref,
  ) {
    const cls = `btn btn-${variant}${
      size === "sm" ? " btn-sm" : size === "lg" ? " btn-lg" : ""
    }`;
    const iconSize = size === "sm" ? 13 : 15;
    return (
      <button
        ref={ref}
        title={title}
        aria-label={ariaLabel}
        type={type}
        className={cls}
        onClick={onClick}
        disabled={disabled}
        style={style}
      >
        {icon && <Icon name={icon} size={iconSize} />}
        {children}
        {trailingIcon && <Icon name={trailingIcon} size={iconSize} />}
      </button>
    );
  },
);

/* ============================================================
   Misc primitives
   ============================================================ */

export function Eyebrow({
  children,
  dot,
  style,
}: {
  children: ReactNode;
  dot?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className="eyebrow"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: 999,
            background: "var(--ink-3)",
            display: "inline-block",
          }}
        />
      )}
      {children}
    </div>
  );
}

export function Rule({
  vertical,
  style,
}: {
  vertical?: boolean;
  style?: CSSProperties;
}) {
  if (vertical) {
    return (
      <span
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "var(--rule)",
          ...style,
        }}
      />
    );
  }
  return <hr className="rule" style={style} />;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; icon?: string }>;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        background: "var(--paper-2)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r)",
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              border: 0,
              background: active ? "var(--card)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-3)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: "calc(var(--r) - 2px)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: active ? "0 1px 2px rgba(26,24,20,0.06)" : "none",
              transition: "all var(--dur) var(--ease)",
            }}
          >
            {o.icon && <Icon name={o.icon} size={13} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: "running" | "draft" | "completed" | string;
}) {
  if (status === "running") {
    return (
      <span
        className="pill"
        style={{
          background: "var(--signal-soft)",
          color: "var(--signal)",
          borderColor: "var(--signal-line)",
        }}
      >
        <span className="rec-dot" style={{ width: 6, height: 6 }} />
        live
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span
        className="pill"
        style={{
          background: "var(--emo-positive-bg)",
          color: "var(--emo-positive)",
          borderColor: "var(--rule)",
        }}
      >
        <Icon name="check" size={11} /> complete
      </span>
    );
  }
  return (
    <span className="pill">
      <Icon name="circle-dashed" size={11} /> draft
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        paddingBottom: 24,
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <div style={{ maxWidth: 720 }}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="display" style={{ margin: "12px 0 8px", fontSize: 44 }}>
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: "var(--ink-3)",
              lineHeight: 1.55,
              maxWidth: 600,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </header>
  );
}

export function SectionHeader({
  number,
  title,
  right,
}: {
  number?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        {number && (
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-4)" }}
          >
            {number}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            color: "var(--ink)",
            fontWeight: 400,
          }}
        >
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}
