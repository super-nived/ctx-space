# Build Plan — Context Space (CTX-SPACE) powered by your own `agent.py`

> Companion to `plan.md`. This document records the **concrete, decided** build approach:
> a Lovable-style PWA React app builder whose **LLM/agent is your own `agent.py`** (FastAPI +
> OpenAI `gpt-5-mini` + DataSpace MCP), connected to a **CopilotKit** frontend over the
> **AG-UI protocol**. WebContainers power the live preview. Verified against current AG-UI +
> CopilotKit docs (2026-06).

---

## 0. The key architectural change vs `plan.md`

`plan.md` Section 4 assumed **CopilotKit Cloud's default agent** generates code (publishable key,
no backend). **We are replacing the brain with `agent.py`.** This is the "custom AG-UI backend"
from `plan.md` §9 — promoted from "later" to **primary, day one**.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js PWA (the builder UI)                                          │
│                                                                        │
│  CopilotKit React UI  ──► chat panel, Edit#N cards, plan card          │
│        │                                                               │
│        │  frontend tools: proposePlan, writeFile, deleteFile           │
│        │  (registered with useHumanInTheLoop / useFrontendTool)        │
│        ▼                                                               │
│  /api/copilotkit (Next route)                                          │
│   CopilotRuntime + HttpAgent({ url: AGENT_URL })  ◄── one config flag  │
└───────────────────────────────────│──────────────────────────────────┘
                                     │  AG-UI events over HTTP (SSE)
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  agent.py  — FastAPI AG-UI endpoint  (your existing file, refactored)  │
│   • receives RunAgentInput (messages, tools, state, context)           │
│   • calls OpenAI gpt-5-mini with: frontend tools + DataSpace MCP tools  │
│   • emits: RUN_STARTED → TEXT_MESSAGE_* / TOOL_CALL_* → RUN_FINISHED    │
│        │                                                               │
│        ├─► DataSpace MCP (https://dataspace-mcp.onrender.com/mcp)       │
│        │   schema/data tools → agent builds DataSpace-aware apps        │
└──────────────────────────────────────────────────────────────────────┘
                                     │  TOOL_CALL_* for writeFile
                                     ▼
              Browser executes the tool handler → WebContainer FS → Vite HMR → preview
```

**The crucial mechanic (this is what makes it work):** `writeFile` / `proposePlan` / `deleteFile`
are **frontend tools**, not server tools. The flow per tool call:

1. Frontend registers the tools; CopilotKit sends their schemas in `RunAgentInput.tools`.
2. `agent.py` passes them to OpenAI as function tools alongside the MCP tools.
3. When the model calls `writeFile`, `agent.py` emits `TOOL_CALL_START` → `TOOL_CALL_ARGS` (streamed) → `TOOL_CALL_END`.
4. CopilotKit accumulates the args, runs the **browser-side handler**, which writes to the WebContainer and renders the Edit#N card.
5. The handler's return value goes back to `agent.py` as a tool result → the model continues.

So **file writes happen in the browser**, driven by tool calls from your agent. The agent never touches a filesystem — clean and sandbox-safe.

---

## 1. SECURITY — do this first (blocking)

Your current `agent.py` has problems that must be fixed before anything else:

- **Line 10: hardcoded OpenAI key.** It is now compromised (it's been read into this session and lives in a file). **Rotate it immediately** at the OpenAI dashboard, then load from env: `OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]`.
- **MCP URL** → move to env too (`MCP_SERVER_URL = os.environ["MCP_SERVER_URL"]`).
- Add a `.env` (already imported via `load_dotenv()`) and a `.gitignore` that excludes `.env`.
- `allow_origins=["*"]` is fine for local dev; before any deploy, restrict to your frontend origin.

This is step 0 of P0 below. Nothing else ships until the key is rotated.

---

## 2. Tech stack (final)

| Concern | Choice |
|---|---|
| Agent backend | **`agent.py`** — FastAPI + `ag-ui-protocol` + OpenAI `gpt-5-mini` + DataSpace MCP |
| Frontend | **Next.js (App Router) + TypeScript** |
| AI bridge | **CopilotKit** `@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`, `@ag-ui/client` |
| Protocol | **AG-UI** (`ag-ui-protocol` Python pkg on the agent; `HttpAgent` on the runtime) |
| Live preview | **WebContainers** (`@webcontainer/api`) — needs COOP/COEP headers |
| Code viewer | Monaco or CodeMirror (read-only v1) |
| Styling | Tailwind + shadcn/ui |
| State | Zustand (virtual FS, chat, history, build status) |
| Publish | GitHub REST via Octokit (OAuth in Next route) |
| PWA | Serwist or `next-pwa` + web manifest |

---

## 3. `agent.py` refactor — turn it into an AG-UI endpoint

Your file already does 80% of this (OpenAI client, MCP tool, FastAPI, sessions). The AG-UI
reference server (docs.ag-ui.com/quickstart/server) is nearly the same shape. Changes:

**Install:** `pip install ag-ui-protocol fastapi uvicorn openai python-dotenv`

**New endpoint** `POST /` (replaces `/chat`) accepting `RunAgentInput` and returning a
`StreamingResponse` of SSE-encoded events:

```python
from ag_ui.core import (
    RunAgentInput, EventType,
    RunStartedEvent, RunFinishedEvent, RunErrorEvent,
    TextMessageStartEvent, TextMessageContentEvent, TextMessageEndEvent,
    ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent,
)
from ag_ui.encoder import EventEncoder
```

Per request:
1. `RUN_STARTED` (thread_id, run_id from input).
2. Build the OpenAI call:
   - **messages**: map `input_data.messages` (user/assistant/system/tool) → OpenAI format.
   - **tools**: merge two sources →
     - **frontend tools** from `input_data.tools` (`proposePlan`, `writeFile`, `deleteFile`) — convert AG-UI `Tool` → OpenAI function schema.
     - **MCP tools**: keep your existing `{"type": "mcp", "server_label": "mps", "server_url": MCP_SERVER_URL, "require_approval": "never"}` block so the agent can read DataSpace schema/data.
   - **system prompt**: the CTX-SPACE prompt from `plan.md` §6, extended with DataSpace guidance (§4 below).
3. Stream the completion:
   - text deltas → `TEXT_MESSAGE_START` / `…_CONTENT` (per chunk) / `…_END`.
   - frontend-tool calls → `TOOL_CALL_START` (toolCallId, toolCallName) / `TOOL_CALL_ARGS` (delta JSON) / `TOOL_CALL_END`. **Do not execute these server-side** — the browser does.
   - MCP tool calls: let OpenAI's `responses`/`mcp` path resolve them server-side (as today); optionally surface them as informational `TOOL_CALL_*` so the UI can show "Reading DataSpace schema…".
4. `RUN_FINISHED` (or `RUN_ERROR` on exception — wrap the generator in try/except).

**Thread memory:** keep your `sessions` idea but key off `input_data.thread_id`. With the
streaming Chat Completions path you maintain history from `input_data.messages` (CopilotKit
sends the full thread), so the manual `previous_response_id` chaining can likely be dropped —
decide based on whether you stay on `responses.create` (MCP-native) or move to
`chat.completions.create` (matches the AG-UI sample). **Open decision — see §8.**

**Note on `responses` vs `chat.completions`:** your current code uses `client.responses.create`
with native `mcp` tooling, which is convenient for MCP but the AG-UI sample uses
`chat.completions.create` with manual streaming. Pick one (see §8 Q1). Either works; the
event-emission logic is identical, only the OpenAI call differs.

---

## 4. DataSpace-aware app generation

Generated apps are **DataSpace-aware** (your chosen option). Two layers:

1. **Agent reasoning:** the agent calls DataSpace MCP tools to discover schema/entities/data
   before proposing a plan, so `proposePlan` reflects the real data model.
2. **Generated output:** the base Vite+React template includes a small **DataSpace client**
   (typed fetch wrapper around your DataSpace API/MCP-exposed endpoints). The agent scaffolds
   components that read/write real DataSpace entities, not mock data.

System-prompt additions (append to `plan.md` §6):
```
DATASPACE: Before proposing a plan, use the DataSpace MCP tools to inspect the available
entities, fields, and relationships. Build apps that read and write real DataSpace data via
the provided DataSpace client (src/lib/dataspace.ts in the template). Never invent fields —
only use entities/fields confirmed via MCP. If the user's request needs data that doesn't
exist, say so in the plan.
```

The base template ships `src/lib/dataspace.ts`. Whether it talks to DataSpace directly from the
browser or proxies through your backend is **Open decision Q2 (§8)** — depends on CORS/auth on
the DataSpace API.

---

## 4b. The Lovable loop — continuous chat + self-healing (the centerpiece)

This is the defining behavior you asked for. The app is **not** "describe → generate → done." It's a
**persistent conversation over a living app**, where the user keeps refining and **errors become
chat messages the agent fixes automatically**. Two intertwined loops run on top of the same chat thread.

### Loop A — continuous refinement (user-driven)
After the first build, every follow-up message is an incremental edit on the *existing* project:
1. User types "make the header blue" / "add a delete button".
2. The full thread + current file state is already in context: CopilotKit sends `RunAgentInput.messages` (whole history) and `useCopilotReadable` exposes the current file tree + framework. So `agent.py` always edits the *real current state*, never starts over.
3. Agent calls `writeFile` **only for the files that change** (system prompt enforces "never rewrite the whole project for a small edit").
4. Each change → new Edit#N card + WebContainer HMR → preview updates live.

**Thread continuity is the key.** One CopilotKit `threadId` per project = one continuous conversation. `agent.py` keys memory off `input_data.thread_id`. The conversation never resets between edits — that's what makes it feel like Lovable.

### Loop B — self-healing (error-driven, auto-detect + auto-fix)
When the generated app breaks, the error is captured and **fed back into the same chat thread automatically**, and the agent fixes it without the user asking:

```
WebContainer / preview iframe
      │  (errors surface from 3 sources)
      ▼
┌─────────────────────────────────────────────────────────┐
│ Error capture layer (frontend)                           │
│  1. install/build errors  → WebContainer process stderr  │
│     (spawn npm install / vite — read exit code + output) │
│  2. compile/HMR errors     → Vite overlay / dev-server WS │
│  3. runtime errors         → iframe window.onerror +     │
│     unhandledrejection, postMessage'd to the parent      │
└─────────────────────────────────────────────────────────┘
      │  dedupe + debounce (don't spam identical errors)
      ▼
Inject as a synthetic chat turn → agent.py runs →
diagnoses → writeFile(fix) → HMR → error gone? ─── yes ──► done, agent posts "Fixed: <one line>"
                                          │
                                          └─ no, still erroring ──► loop again (capped, see below)
```

**Mechanics:**
- **Three error sources**, all funneled into one "preview error" signal:
  - *Install/build*: capture stdout/stderr + exit code from the WebContainer `spawn('npm', ['install'])` / dev-server process.
  - *Compile / HMR*: listen to Vite's error overlay / HMR websocket messages inside the container.
  - *Runtime*: inject a tiny error-catcher into the preview app (`window.onerror`, `window.onunhandledrejection`) that `postMessage`s errors to the parent frame.
- **Auto-fix trigger:** on a fresh, deduped error, the frontend posts a synthetic message into the same thread — e.g. *"The preview is erroring with: `<message>` in `<file>:<line>`. Fix it."* — using CopilotKit's programmatic append (`useCopilotChat` `appendMessage`, or v2 equivalent). This drives `agent.py` exactly as if the user typed it.
- **Latest error as readable context too:** `useCopilotReadable({ description: "latest preview error", value: lastError })` so even a normal user edit carries the current error state.
- **Agent's job** (system prompt, ERRORS section from `plan.md` §6, strengthened): "When a preview error is reported, diagnose it, edit only the offending file(s) via writeFile, and explain the fix in one sentence. Do not re-scaffold."
- **Convergence guardrails (critical — prevents infinite fix loops / token burn):**
  - Cap auto-fix attempts per distinct error signature (e.g. **3 tries**). After that, stop and post: *"I couldn't auto-fix this after 3 attempts — here's what I see, how do you want to proceed?"* → hands control back to the user (degrades to "ask first").
  - Dedupe by error signature (message + file + line) so the same error isn't re-sent while a fix is in flight.
  - Debounce HMR errors (a half-saved file errors transiently) — wait for the dev server to settle before deciding it's a real error.
  - Show auto-fix attempts as normal Edit#N cards flagged "auto-fix" so the user sees and can interrupt/undo (History + Restore from `plan.md` §5.7 is the escape hatch).

### State machine (one project)
```
        ┌────────── user message ──────────┐
        ▼                                   │
   PLANNING ──approve──► BUILDING ──►  IDLE/READY ◄───── user follow-up edit ─────┐
        ▲   (proposePlan / HITL)      │         │                                  │
        │                             │         │ preview error detected           │
        └──── user edits plan ────────┘         ▼ (auto)                           │
                                          SELF_HEALING ── fix ──► verify ──fixed──► IDLE
                                                 │                                  ▲
                                                 └── still broken & <3 tries ───────┘
                                                 └── ≥3 tries ──► ASK_USER ──────────┘
```
All transitions happen **within the one continuous chat thread** — that's the Lovable feel.

---

## 5. Frontend — CopilotKit wiring

**`app/api/copilotkit/route.ts`** (the bridge — exactly the docs pattern):
```ts
import { CopilotRuntime, ExperimentalEmptyAdapter, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";

const runtime = new CopilotRuntime({
  agents: { ctx_space: new HttpAgent({ url: process.env.AGENT_URL! }) }, // ← your agent.py
});
// ExperimentalEmptyAdapter because the LLM lives in agent.py, not here.
```
`AGENT_URL` = `http://localhost:8000/` in dev. **This one env var is the `plan.md` §9 config flag** — point it at agent.py now, or any other AG-UI backend later, with zero UI changes.

**Provider** (`app/layout.tsx`): `<CopilotKit runtimeUrl="/api/copilotkit" agent="ctx_space">`.

**Frontend tools** (the file-writing brain lives here):
- `proposePlan` → **`useHumanInTheLoop`** (the v2 replacement for `renderAndWaitForResponse`). Renders the plan-approval card; `respond(approval)` returns the user's decision to the agent. (Confirmed in docs: `render: ({args, respond, status}) => …`.)
- `writeFile({path, contents})` → **`useFrontendTool`** (v2) / `useCopilotAction` (v1). Handler: (a) update Zustand FS, (b) append Edit#N card with diff, (c) `webcontainer.fs.writeFile(...)` → HMR.
- `deleteFile({path})` → same pattern.

**Context to agent** via `useCopilotReadable`: current file tree, framework, latest preview error, Knowledge notes — so follow-up edits are incremental.

**Continuous chat + self-heal plumbing** (see §4b):
- One `threadId` per project; never reset it between edits.
- `useCopilotChat` (v2: equivalent) `appendMessage` to programmatically inject captured preview errors into the thread as synthetic turns → drives the auto-fix loop.
- An error-capture module subscribing to WebContainer process output, Vite HMR/overlay, and `postMessage` runtime errors from the preview iframe; deduped + debounced; capped at 3 auto-fix attempts per error signature.

> API-version note from `plan.md` §8 confirmed true: prefer **v2** hooks (`useFrontendTool`, `useHumanInTheLoop`, `@copilotkit/react-ui/v2/styles.css`). v1 `useCopilotAction` still works.

---

## 6. Implementation phases

- **P0 — Security + agent scaffold.** Rotate the key; env-ify secrets; `pip install ag-ui-protocol`; convert `agent.py` to the AG-UI `POST /` streaming endpoint; smoke-test with a raw curl that it emits `RUN_STARTED…RUN_FINISHED`. *(plan.md had no P0 — added because of the leaked key.)*
- **P1 — Chat shell + bridge.** Next.js + CopilotKit provider + `/api/copilotkit` → `HttpAgent(agent.py)`. Landing prompt screen + workspace shell (top bar, left chat, right Preview/Code tabs). End state: you can chat with `agent.py` through the Lovable-style UI.
- **P2 — Plan + generate.** `proposePlan` via `useHumanInTheLoop` (approval pause) + `writeFile`/`deleteFile` frontend tools → Zustand virtual FS + Edit#N cards with diffs + file tree + code viewer. Wire DataSpace MCP inspection into the plan step.
- **P3 — Live preview (WebContainers).** Boot WebContainer, mount Vite+React+TS+shadcn+Tailwind template (incl. `src/lib/dataspace.ts` + a tiny runtime error-catcher that `postMessage`s `window.onerror`/`unhandledrejection` to the parent), `npm install`, `npm run dev`, iframe on `server-ready`, HMR on each writeFile, device toggle.
- **P3b — Self-healing loop (§4b, the Lovable behavior).** Build the error-capture module (install/build stderr + Vite HMR/overlay + iframe runtime errors), dedupe/debounce, auto-inject errors into the thread via `appendMessage`, agent auto-fixes, 3-attempt cap → fall back to ASK_USER. This is what makes follow-up chat *continuous and self-correcting* — treat it as a first-class phase, not polish.
- **P4 — Publish + history.** GitHub OAuth + Octokit create/push + zip fallback; edit history with Restore (FS snapshots) — also the user's escape hatch from a bad auto-fix.
- **P4b — Responsive + PWA** (build alongside P1–P4): Tailwind breakpoints from P1; manifest + icons + service worker + offline shell; verify SW scope doesn't strip COOP/COEP from the preview route.
- **P5 — Later:** visual edits mode, Knowledge drawer, deploy button, generated-app PWA toggle, swap `agent.py`'s OpenAI for another model behind the same AG-UI contract.

---

## 7. Acceptance criteria (delta from `plan.md` §11)

All of `plan.md` §11, **plus**:
- [ ] The OpenAI key is rotated and loaded from env; no secrets in source.
- [ ] CopilotKit talks to `agent.py` over AG-UI (verified: events stream, tools resolve).
- [ ] `agent.py` exposes both frontend tools (writeFile/proposePlan/deleteFile) and DataSpace MCP tools to the model.
- [ ] Generated apps read real DataSpace data via the template's DataSpace client (no mock data when real entities exist).
- [ ] Swapping `AGENT_URL` to a different AG-UI endpoint requires no frontend changes.
- [ ] **Continuous chat:** follow-up messages edit the existing app incrementally on one persistent thread (no re-scaffold, no context reset between edits).
- [ ] **Self-healing:** an injected build/runtime error is auto-captured, fed into the chat, and the agent fixes it automatically; preview goes green without the user pasting anything.
- [ ] Auto-fix is capped (≥3 attempts → hands back to the user) and never loops infinitely; auto-fix edits appear as Edit#N cards and are restorable.

---

## 8. Open decisions (need your call before/at coding)

1. **OpenAI call style in `agent.py`:** keep `client.responses.create` (native MCP, your current code) or move to `client.chat.completions.create` (matches AG-UI sample, manual MCP). Recommendation: **keep `responses.create`** for MCP convenience, emit AG-UI events around it. Confirm.
2. **DataSpace access from generated apps:** browser → DataSpace API directly (needs CORS + a safe auth model), or proxy through a backend route? Depends on how the DataSpace API authenticates.
3. **`gpt-5-mini` for code-gen:** strong enough for whole-file React generation, or use a larger model for the build step and keep mini for chat? (Tool-calling fidelity matters most here.)
4. Carry over `plan.md` §13 open questions (persistence, repo visibility, deploy step, branding, Knowledge drawer in v1).

---

## 9. First concrete steps

1. **Rotate the OpenAI key now.** (Blocking.)
2. `pip install ag-ui-protocol` and refactor `agent.py` → AG-UI `POST /` (P0). I can do this next.
3. `npx create-next-app@latest`, add CopilotKit packages + `/api/copilotkit` route pointing at `http://localhost:8000/`.
4. Verify end-to-end chat through the UI before building any file-gen logic.
