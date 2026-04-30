"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Eyebrow,
  Icon,
  PageHeader,
  Pill,
} from "@/components/research/primitives";
import { useSettingsStore } from "@/stores/settings-store";
import { AVAILABLE_MODELS } from "@/lib/ai/models";
import { PROMPT_CATEGORIES } from "@/config/prompts";

interface PromptData {
  id: string;
  name: string;
  category: string;
  defaultTemplate: string;
  template: string;
  isCustomized: boolean;
  variables: Array<{ name: string; description: string }>;
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card" style={{ padding: 26 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
          gap: 24,
        }}
      >
        <div>
          <span
            className="serif"
            style={{ fontSize: 22, color: "var(--ink)" }}
          >
            {title}
          </span>
          {hint && (
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink-3)",
                marginTop: 4,
              }}
            >
              {hint}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function KeyRow({
  label,
  value,
  onChange,
  show,
  setShow,
  placeholder,
  serverConfigured,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  placeholder: string;
  serverConfigured: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr auto auto",
        gap: 14,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--ink)" }}>
        {label}
      </span>
      {serverConfigured ? (
        <span
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            fontStyle: "italic",
          }}
        >
          Provided by server environment.
        </span>
      ) : (
        <input
          className="input"
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
          }}
        />
      )}
      <Button
        size="sm"
        variant="ghost"
        icon={show ? "eye-off" : "eye"}
        onClick={() => setShow(!show)}
        disabled={serverConfigured}
      >
        {show ? "Hide" : "Show"}
      </Button>
      <span
        className="pill"
        style={{
          background: value
            ? "var(--emo-positive-bg)"
            : "var(--paper-2)",
          color: value
            ? "var(--emo-positive)"
            : "var(--ink-3)",
          borderColor: "var(--rule)",
        }}
      >
        <span
          className="avatar-dot"
          style={{
            background: value
              ? "var(--emo-positive)"
              : "var(--ink-4)",
          }}
        />{" "}
        {serverConfigured
          ? "server"
          : value
            ? "configured"
            : "missing"}
      </span>
    </div>
  );
}

function GeneralCard() {
  const {
    anthropicKey,
    openaiKey,
    activeProvider,
    activeModel,
    isLoaded,
    setAnthropicKey,
    setOpenaiKey,
    setActiveProvider,
    setActiveModel,
    loadSettings,
    saveSetting,
  } = useSettingsStore();
  const [anthropicInput, setAnthropicInput] = useState("");
  const [openaiInput, setOpenaiInput] = useState("");
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (isLoaded) {
      setAnthropicInput(
        anthropicKey === "server-configured" ? "" : anthropicKey,
      );
      setOpenaiInput(
        openaiKey === "server-configured" ? "" : openaiKey,
      );
    }
  }, [isLoaded, anthropicKey, openaiKey]);

  const filteredModels = AVAILABLE_MODELS.filter(
    (m) => m.provider === activeProvider,
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (anthropicInput && !anthropicInput.includes("...")) {
        await saveSetting("anthropic_api_key", anthropicInput);
        setAnthropicKey(anthropicInput);
      }
      if (openaiInput && !openaiInput.includes("...")) {
        await saveSetting("openai_api_key", openaiInput);
        setOpenaiKey(openaiInput);
      }
      await saveSetting("active_provider", activeProvider);
      await saveSetting("active_model", activeModel);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card
        title="API keys"
        hint="Keys are stored locally per workspace. They never leave your browser unless used for API calls."
      >
        <KeyRow
          label="Anthropic"
          value={anthropicInput}
          onChange={setAnthropicInput}
          show={showAnthropic}
          setShow={setShowAnthropic}
          placeholder="sk-ant-…"
          serverConfigured={anthropicKey === "server-configured"}
        />
        <KeyRow
          label="OpenAI"
          value={openaiInput}
          onChange={setOpenaiInput}
          show={showOpenai}
          setShow={setShowOpenai}
          placeholder="sk-…"
          serverConfigured={openaiKey === "server-configured"}
        />
      </Card>

      <Card
        title="Active provider"
        hint="Determines which model list is available below."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          {(["anthropic", "openai"] as const).map((provider) => {
            const active = activeProvider === provider;
            return (
              <button
                key={provider}
                type="button"
                onClick={() => {
                  setActiveProvider(provider);
                  const firstModel = AVAILABLE_MODELS.find(
                    (m) => m.provider === provider,
                  );
                  if (firstModel) setActiveModel(firstModel.id);
                }}
                style={{
                  textAlign: "left",
                  padding: 16,
                  background: active
                    ? "var(--card)"
                    : "var(--paper)",
                  border: `1px solid ${
                    active ? "var(--ink)" : "var(--rule)"
                  }`,
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  transition: "all var(--dur) var(--ease)",
                  boxShadow: active
                    ? "0 0 0 2px rgba(26,24,20,0.08)"
                    : "none",
                }}
              >
                <div
                  className="serif"
                  style={{
                    fontSize: 18,
                    color: "var(--ink)",
                    marginBottom: 4,
                    textTransform: "capitalize",
                  }}
                >
                  {provider === "anthropic" ? "Anthropic" : "OpenAI"}
                </div>
                <div
                  style={{ fontSize: 13, color: "var(--ink-3)" }}
                >
                  {provider === "anthropic"
                    ? "Claude models (multimodal)."
                    : "GPT and o-series models."}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Default model">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {filteredModels.map((model) => {
            const active = activeModel === model.id;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => setActiveModel(model.id)}
                style={{
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: active
                    ? "var(--card)"
                    : "var(--paper)",
                  border: `1px solid ${
                    active ? "var(--ink)" : "var(--rule)"
                  }`,
                  borderRadius: "var(--r)",
                  cursor: "pointer",
                  transition: "all var(--dur) var(--ease)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--ink)",
                      fontWeight: 500,
                    }}
                  >
                    {model.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-3)",
                      marginTop: 2,
                    }}
                  >
                    {model.description}
                  </div>
                </div>
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
              </button>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="primary"
          icon="save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </>
  );
}

function PromptsCard() {
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<
    Set<string>
  >(new Set());
  const [editedTemplates, setEditedTemplates] = useState<
    Record<string, string>
  >({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/prompts");
      setPrompts(await res.json());
    } catch {
      toast.error("Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const getCurrent = (p: PromptData) =>
    editedTemplates[p.id] ?? p.template;
  const isEdited = (p: PromptData) => {
    const e = editedTemplates[p.id];
    return e !== undefined && e !== p.template;
  };

  const save = async (p: PromptData) => {
    const template = getCurrent(p);
    setSavingIds((prev) => new Set(prev).add(p.id));
    try {
      const res = await fetch("/api/settings/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, template }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Saved “${p.name}”`);
      setEditedTemplates((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      await fetchPrompts();
    } catch {
      toast.error(`Failed to save “${p.name}”`);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  };

  const reset = async (p: PromptData) => {
    setSavingIds((prev) => new Set(prev).add(p.id));
    try {
      await fetch(
        `/api/settings/prompts?id=${encodeURIComponent(p.id)}`,
        { method: "DELETE" },
      );
      toast.success(`Reset “${p.name}”`);
      setEditedTemplates((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      await fetchPrompts();
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "var(--ink-3)",
        }}
      >
        <Eyebrow>loading</Eyebrow>
      </div>
    );
  }

  const grouped = PROMPT_CATEGORIES.map((cat) => ({
    category: cat,
    prompts: prompts.filter((p) => p.category === cat),
  }));

  return (
    <Card
      title="Agent prompts"
      hint={
        <>
          Customise the prompts the Researcher, Persona, and Synthesiser
          agents use. Variables in{" "}
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              background: "var(--paper-2)",
              padding: "1px 6px",
              borderRadius: 3,
            }}
          >
            {"{{braces}}"}
          </code>{" "}
          are replaced at runtime.
        </>
      }
    >
      {grouped.map(({ category, prompts: catPrompts }) => {
        if (catPrompts.length === 0) return null;
        const expanded = expandedCategories.has(category);
        const customised = catPrompts.filter((p) => p.isCustomized).length;
        return (
          <div
            key={category}
            style={{
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
              background: "var(--paper)",
            }}
          >
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                color: "var(--ink)",
                transition: "background var(--dur) var(--ease)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Icon
                  name={expanded ? "chevron-down" : "chevron-right"}
                  size={14}
                />
                <span
                  className="serif"
                  style={{ fontSize: 16, color: "var(--ink)" }}
                >
                  {category}
                </span>
                <Pill>{catPrompts.length}</Pill>
                {customised > 0 && (
                  <Pill tone="accent">{customised} customised</Pill>
                )}
              </div>
            </button>
            {expanded && (
              <div style={{ borderTop: "1px solid var(--rule)" }}>
                {catPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    style={{
                      padding: 16,
                      borderBottom: "1px solid var(--rule)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            color: "var(--ink)",
                            fontWeight: 500,
                          }}
                        >
                          {prompt.name}
                        </span>
                        {prompt.isCustomized && (
                          <Pill tone="accent">customised</Pill>
                        )}
                        {isEdited(prompt) && (
                          <Pill tone="signal">unsaved</Pill>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {prompt.isCustomized && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="rotate-ccw"
                            onClick={() => reset(prompt)}
                            disabled={savingIds.has(prompt.id)}
                          >
                            Reset
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="save"
                          onClick={() => save(prompt)}
                          disabled={
                            savingIds.has(prompt.id) || !isEdited(prompt)
                          }
                        >
                          {savingIds.has(prompt.id) ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                    {prompt.variables.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        {prompt.variables.map((v) => (
                          <span
                            key={v.name}
                            title={v.description}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "1px 8px",
                              borderRadius: "var(--r-sm)",
                              background: "var(--paper-2)",
                              border: "1px solid var(--rule)",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--ink-3)",
                            }}
                          >
                            {`{{${v.name}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                    <textarea
                      className="textarea"
                      value={getCurrent(prompt)}
                      onChange={(e) =>
                        setEditedTemplates((prev) => ({
                          ...prev,
                          [prompt.id]: e.target.value,
                        }))
                      }
                      rows={9}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        lineHeight: 1.6,
                        minHeight: 140,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"general" | "prompts">("general");

  return (
    <div
      style={{
        padding: "32px 48px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Manage API keys, default models for personas and synthesis, and customise the agent prompts."
      />

      <div
        style={{
          display: "inline-flex",
          padding: 3,
          background: "var(--paper-2)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r)",
          gap: 2,
          marginTop: 28,
          marginBottom: 28,
        }}
      >
        {(
          [
            { value: "general", label: "General" },
            { value: "prompts", label: "Prompts" },
          ] as const
        ).map((t) => {
          const active = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              style={{
                border: 0,
                background: active ? "var(--card)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-3)",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 500,
                padding: "6px 14px",
                borderRadius: "calc(var(--r) - 2px)",
                cursor: "pointer",
                boxShadow: active
                  ? "0 1px 2px rgba(26,24,20,0.06)"
                  : "none",
                transition: "all var(--dur) var(--ease)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {tab === "general" ? <GeneralCard /> : <PromptsCard />}
      </div>
    </div>
  );
}
