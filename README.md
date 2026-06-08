# Context Space (CTX-SPACE)

A chat-driven, Lovable-style AI app builder. Describe an app in plain English; an
agent plans it, builds a React app live, runs it in an in-browser preview, and
keeps refining it through continuous conversation — including **self-healing** when
the generated app errors.

The agent is **your own** OpenAI + DataSpace-MCP agent (not a hosted default LLM),
connected to a CopilotKit React UI over the **AG-UI protocol**.

## Repository layout

```
backend/    FastAPI AG-UI agent (OpenAI + DataSpace MCP)  — see backend/README.md
frontend/   React + Vite builder UI (CopilotKit)          — see frontend/README.md
plan.md         Original product spec (Lovable parity)
build-plan.md   Concrete architecture + phased build plan (READ THIS)
```

## Architecture in one diagram

```
React UI (CopilotKit) ──/api/copilotkit──► CopilotKit runtime (Vite middleware)
                                                   │ AG-UI over HTTP (SSE)
                                                   ▼
                                  FastAPI agent (backend/app/agent.py)
                                     │ OpenAI gpt-5-mini  │ DataSpace MCP
        writeFile/proposePlan tool calls ◄───────────────┘
                 │ (executed in the browser)
                 ▼
        Virtual FS → WebContainer (P3) → live preview + self-healing (P3b)
```

The single `AGENT_URL` env var points the runtime at the agent — swap it to use
any AG-UI backend without changing the UI.

## Quick start

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in a ROTATED OpenAI key (see Security)
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

## Security

The OpenAI key that was previously hard-coded in `agent.py` is **compromised** and
must be rotated. All secrets now load from environment / `.env` (git-ignored). Never
commit `.env`.

## Build status

- [x] **P0** — Secure backend + AG-UI streaming agent (OpenAI + MCP), tested.
- [x] **P1** — React/Vite UI, CopilotKit runtime bridge, Lovable-style workspace.
- [ ] **P2** — Plan approval + writeFile → virtual FS + Edit #N cards (tools wired; UI cards next).
- [ ] **P3** — WebContainers live preview.
- [ ] **P3b** — Self-healing loop (auto-detect + auto-fix).
- [ ] **P4** — Publish to GitHub + history/restore.

See `build-plan.md` for the full plan.

## Contributing

Conventional commits. Run `npm run lint && npm run typecheck && npm test` (frontend)
and `ruff check app/ && pytest` (backend) before pushing.
# ctx-space
