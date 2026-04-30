"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button, Eyebrow, Icon } from "@/components/research/primitives";

export interface ConfirmOptions {
  title: string;
  /** Body copy — short paragraph or ReactNode. */
  body?: ReactNode;
  /** Confirm button label. Defaults to "Delete". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** "danger" (red) | "primary" (default ink). */
  tone?: "danger" | "primary";
  /** Lucide icon name shown in the header. Defaults to "alert-triangle". */
  icon?: string;
}

interface InternalState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Styled confirm dialog. Returns a `confirm(opts) → Promise<boolean>` and
 * the dialog node to mount once near the root of the consumer.
 */
export function useConfirm() {
  const [state, setState] = useState<InternalState | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      if (!state) return;
      state.resolve(ok);
      setState(null);
    },
    [state],
  );

  // ESC closes; auto-focus cancel for safety.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        close(true);
      }
    };
    document.addEventListener("keydown", onKey);
    cancelBtnRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  const dialog = state ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => close(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 24, 20, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 32,
        animation: "msg-in 200ms var(--ease) both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "var(--paper)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-md)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "0 16px 48px rgba(26, 24, 20, 0.18)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background:
                state.tone === "danger"
                  ? "var(--emo-frustrated-bg)"
                  : "var(--paper-2)",
              color:
                state.tone === "danger"
                  ? "var(--emo-frustrated)"
                  : "var(--ink-2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon
              name={state.icon ?? "alert-triangle"}
              size={18}
            />
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Eyebrow>Confirm</Eyebrow>
            <h2
              id="confirm-title"
              className="serif"
              style={{
                margin: "4px 0 0",
                fontSize: 20,
                fontWeight: 400,
                color: "var(--ink)",
                lineHeight: 1.3,
              }}
            >
              {state.title}
            </h2>
          </div>
        </div>
        {state.body && (
          <div
            style={{
              fontSize: 14,
              color: "var(--ink-2)",
              lineHeight: 1.55,
              paddingLeft: 48,
            }}
          >
            {state.body}
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 6,
          }}
        >
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn btn-ghost"
            onClick={() => close(false)}
          >
            {state.cancelLabel ?? "Cancel"}
          </button>
          <Button
            variant={state.tone === "danger" ? "signal" : "primary"}
            onClick={() => close(true)}
          >
            {state.confirmLabel ?? "Delete"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
