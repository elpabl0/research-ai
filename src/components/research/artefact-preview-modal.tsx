"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/research/primitives";

interface ArtifactRow {
  id: string;
  filename: string;
  kind: "document" | "image";
  path: string;
  mimeType: string;
}

interface Props {
  artefacts: ArtifactRow[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  onDelete: (id: string) => void | Promise<void>;
}

function uploadUrl(path: string) {
  return `/api/uploads/${path}`;
}

function DocumentPreview({ artefact }: { artefact: ArtifactRow }) {
  const url = uploadUrl(artefact.path);
  const mime = artefact.mimeType ?? "";

  const isPdf = mime.includes("pdf");
  const isPlainText =
    mime.startsWith("text/") ||
    mime === "application/json" ||
    /\.(md|txt|csv|tsv|json)$/i.test(artefact.filename);

  const [textState, setTextState] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    text: string | null;
  }>(() => ({
    status: isPlainText ? "loading" : "idle",
    text: null,
  }));

  useEffect(() => {
    if (!isPlainText) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("not ok"))))
      .then((t) => {
        if (cancelled) return;
        setTextState({ status: "ok", text: t.slice(0, 100_000) });
      })
      .catch(() => {
        if (cancelled) return;
        setTextState({ status: "error", text: null });
      });
    return () => {
      cancelled = true;
    };
  }, [url, isPlainText]);

  const { status: textStatus, text } = textState;

  if (isPdf) {
    return (
      <iframe
        src={url}
        title={artefact.filename}
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r)",
          background: "var(--card)",
        }}
      />
    );
  }

  if (isPlainText) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          padding: 24,
          border: "1px solid var(--rule)",
          borderRadius: "var(--r)",
          background: "var(--card)",
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "var(--ink-2)",
          whiteSpace: "pre-wrap",
        }}
      >
        {textStatus === "loading"
          ? "Loading…"
          : textStatus === "error"
            ? "Could not preview this file."
            : text}
      </div>
    );
  }

  // Office documents and other binaries — offer a download.
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        border: "1px solid var(--rule)",
        borderRadius: "var(--r)",
        background: "var(--card)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: "var(--paper-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-2)",
        }}
      >
        <Icon name="file" size={28} />
      </span>
      <div className="serif" style={{ fontSize: 18, color: "var(--ink)" }}>
        Inline preview not supported for this file type.
      </div>
      <div className="mono" style={{ fontSize: 11 }}>
        {artefact.mimeType || "unknown mime type"}
      </div>
      <a
        href={url}
        download={artefact.filename}
        className="btn btn-secondary"
        style={{ textDecoration: "none" }}
      >
        <Icon name="download" size={14} /> Download
      </a>
    </div>
  );
}

export function ArtefactPreviewModal({
  artefacts,
  index,
  onClose,
  onIndexChange,
  onDelete,
}: Props) {
  const artefact = artefacts[index];

  // ESC + arrow key navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      else if (e.key === "ArrowRight" && index < artefacts.length - 1)
        onIndexChange(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [artefacts.length, index, onClose, onIndexChange]);

  if (!artefact) return null;

  const url = uploadUrl(artefact.path);
  const isFirst = index === 0;
  const isLast = index === artefacts.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${artefact.filename}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 24, 20, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 32,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1000px, 100%)",
          height: "min(85vh, 100%)",
          background: "var(--paper)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "var(--r-md)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 18px",
            borderBottom: "1px solid var(--rule)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            <Icon
              name={artefact.kind === "image" ? "image" : "file-text"}
              size={16}
            />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
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
                {artefact.filename}
              </span>
              <span className="mono" style={{ fontSize: 10 }}>
                {index + 1} of {artefacts.length} ·{" "}
                {artefact.mimeType || "unknown"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <Button
              size="sm"
              variant="ghost"
              icon="chevron-left"
              onClick={() => onIndexChange(index - 1)}
              disabled={isFirst}
              ariaLabel="Previous"
            >
              {""}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="chevron-right"
              onClick={() => onIndexChange(index + 1)}
              disabled={isLast}
              ariaLabel="Next"
            >
              {""}
            </Button>
            <a
              href={url}
              download={artefact.filename}
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: "none" }}
              title="Download"
            >
              <Icon name="download" size={13} />
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{
                color: "var(--emo-frustrated)",
              }}
              onClick={() => void onDelete(artefact.id)}
              title="Delete"
            >
              <Icon name="trash-2" size={13} />
            </button>
            <Button
              size="sm"
              variant="ghost"
              icon="x"
              onClick={onClose}
              ariaLabel="Close"
            >
              {""}
            </Button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--paper-2)",
          }}
        >
          {artefact.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={artefact.filename}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "var(--r-sm)",
                background: "var(--card)",
                boxShadow: "0 1px 2px rgba(26,24,20,0.06)",
              }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%" }}>
              <DocumentPreview artefact={artefact} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
