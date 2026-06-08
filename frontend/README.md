# Context Space — Frontend (React + Vite)

The Lovable-style builder UI. A React SPA that connects to the FastAPI AG-UI
agent through the CopilotKit runtime (mounted as Vite dev-server middleware).

## Stack

- **Vite + React 19 + TypeScript (strict)**
- **CopilotKit v2** (`@copilotkit/react-core/v2`) — chat, frontend tools, HITL
- **@ag-ui/client** — `HttpAgent` bridge to the agent
- **Tailwind CSS v4** — design tokens in `src/index.css`
- **Zustand** — project state (virtual FS, edits, status)
- **ESLint + Prettier + Vitest**

## Layout

```
server/
  copilotRuntimePlugin.ts   Vite middleware mounting the CopilotKit runtime -> FastAPI
src/
  app/CopilotProvider.tsx   CopilotKitProvider (runtimeUrl)
  features/
    landing/                Landing prompt screen
    workspace/              Two-pane builder (TopBar, ChatPanel, OutputPanel, ...)
    agent/                  Frontend tools (writeFile/deleteFile/proposePlan) + runner
  store/projectStore.ts     Virtual FS + edit history + status
  types/                    Shared domain types
```

## Setup

```bash
npm install
cp .env.example .env        # AGENT_URL points at the FastAPI backend
```

## Run (needs the backend on :8000)

```bash
# terminal 1 — backend (see ../backend/README.md)
cd ../backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend
npm run dev                 # http://localhost:5173
```

The Vite logs show the bridge:
`CopilotKit runtime: /api/copilotkit -> http://localhost:8000/ (agent "ctx_space")`.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server + runtime middleware |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | tsc --noEmit |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm test` | Vitest |

## Notes

- The single `AGENT_URL` env var is the "swap the brain" flag — point it at any
  AG-UI backend without touching React (build-plan.md section 9).
- COOP/COEP headers are set in `vite.config.ts` for WebContainers (P3).
- `@/*` is aliased to `src/*`.
