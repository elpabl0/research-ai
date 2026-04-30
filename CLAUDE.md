@AGENTS.md

## Architecture

### Overview
`research-ai` is a full-stack Next.js 16 app for running AI-powered user research interviews. The frontend is React 19 with shadcn/ui and Zustand. The backend is Next.js API routes backed by SQLite (Drizzle ORM). LLM orchestration uses the Vercel AI SDK against Anthropic Claude or OpenAI.

### Project Structure

```
src/
├── app/
│   ├── api/                    # Server-side route handlers (Node.js runtime)
│   ├── study/[studyId]/        # Study pages: overview, plan, run, report
│   ├── personas/               # Persona library management
│   └── settings/               # API keys & model configuration
├── components/
│   ├── research/               # Domain-specific UI (plan editor, session viewer)
│   └── ui/                     # shadcn/ui base components
├── config/                     # Personas, research constants, system prompts
├── lib/
│   ├── agents/                 # AI agent logic (persona, researcher, synthesizer)
│   ├── ai/                     # LLM provider abstraction (Anthropic / OpenAI)
│   ├── db/                     # Drizzle schema & DB singleton
│   └── uploads/                # File parsing & prompt loading
└── stores/                     # Zustand state (study draft, SSE stream, settings)
data/                           # SQLite DB file + uploaded files (gitignored)
drizzle/                        # Auto-generated DB migrations
```

### Key Components

| File | Responsibility |
|------|----------------|
| `src/lib/research-runner.ts` | Core orchestrator — runs entire study: sessions, turns, follow-ups, synthesis |
| `src/lib/research-event-bus.ts` | In-memory SSE channel; emits real-time events per study to the browser |
| `src/lib/agents/persona.ts` | Generates persona responses (single questions and sequenced UI flows) |
| `src/lib/agents/researcher.ts` | Generates the research plan and follow-up questions (depth-limited to 2) |
| `src/lib/agents/synthesizer.ts` | Produces turn, session, and final report synthesis |
| `src/lib/db/schema.ts` | Drizzle ORM table definitions — authoritative data model |
| `src/app/api/studies/[studyId]/run/route.ts` | Triggers study execution; streams SSE to browser |

### Data Flow

```
Study created
  → Plan generated (researcher agent)
  → Questions edited & personas assigned
  → Artifacts uploaded (PDFs/images extracted & stored)
  → Study run triggered
      → For each persona/session:
          → For each question/turn:
              → Persona responds (persona agent, with optional image attachments)
              → Researcher generates follow-ups (max depth 2)
              → Turn synthesized (synthesizer agent)
          → Session synthesized
      → Final report generated (synthesizer agent)
  → Report sections editable in UI & exportable as PDF
```

All events stream to the browser in real time via SSE (`research-event-bus.ts`).

### Data Model

SQLite tables follow this hierarchy:

```
studies
  ├── studyArtifacts          (uploaded docs/images)
  ├── researchPlans
  │     └── planQuestions
  │           └── questionAttachments
  ├── sessions
  │     └── turns
  │           └── responses
  │                 └── followUps
  └── synthesis / reportSections
```

### Design Decisions

- **SQLite + WAL mode** — Local-first, single-user; WAL allows concurrent reads during writes without a separate DB server.
- **SSE over WebSockets** — Simpler for unidirectional server→client streaming from `research-runner.ts`; no socket lifecycle to manage.
- **Modular AI agents** — `persona`, `researcher`, and `synthesizer` are separate modules with Zod-validated structured output, making it easy to swap prompts or models independently.
- **Vercel AI SDK** — Provider-agnostic abstraction over Anthropic and OpenAI; active model is switchable at runtime via the Settings page.
- **Depth-limited follow-ups** — Max 2 levels prevents runaway token usage while preserving meaningful conversational depth.
- **Synthesis layers** — Turn → session → report gives progressive refinement without re-processing all raw responses.
- **Standalone output** — `next.config.ts` sets `output: "standalone"` for self-contained Docker/server deployment.

## Build & Run

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm run start
```

## Testing

```bash
# Lint (only available code quality check — no test runner configured)
npm run lint
```
