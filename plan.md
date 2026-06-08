# Build Spec & Prompt — "Context Space" (CTX-SPACE): a Lovable-style AI app builder

> **How to use this document.** This is both a *specification* (for you and your team to read) and a *build prompt* (paste the whole thing into a coding agent — Claude Code, Cursor, or another app builder — to scaffold the project). It describes a web application where a user describes an app in plain English, an AI generates the code, build progress streams live, a live preview runs in the browser, and the result can be published to GitHub. **The UI flow mirrors the Lovable editor exactly** (see Section 2). Product name: **Context Space**; short brand / codename: **CTX-SPACE**.

---

## 1. Product in one paragraph

Context Space (CTX-SPACE) is a chat-driven AI app builder. The user describes what they want to build; the AI proposes a short plan, the user approves it, and the AI generates a working React application while the user watches progress stream in real time. A live preview pane runs the generated app in the browser. When satisfied, the user clicks **Publish** to push the generated code to a new GitHub repository (with an optional deploy step). The chat/AI layer is built with **CopilotKit**; the code-execution/preview layer uses **WebContainers**; publishing uses the **GitHub API**. The interface follows the Lovable model: a conversational left panel, a live preview/code right panel, an edit history you can restore, and (later) a click-to-edit visual mode.

Context Space is **fully responsive across phone, tablet, and desktop** and is an installable **Progressive Web App (PWA)** — see Sections 2.9 and 2.10.

v1 mirrors the *core* Lovable flow (prompt → plan → build → preview → publish). Lovable extras — Supabase backend provisioning, Stripe wiring, visual drag-edit mode, themes, image generation — are **out of scope for v1** and listed in Section 14.

---

## 2. UI reference — matches the Lovable editor exactly

The product has two screens: a **landing/new-project** screen and the **builder workspace**.

### 2.1 Landing / new project
- Centered, oversized prompt box: **"What do you want to build?"** with a primary **Create** / send button.
- A row of example **prompt chips** below it ("a todo app", "a habit tracker", "a landing page", "a dashboard").
- Minimal chrome: logo/wordmark **Context Space** top-left, account menu top-right.
- Submitting the prompt creates a project and transitions into the builder workspace.

### 2.2 Builder workspace — layout
A full-height two-pane layout with a slim top bar.

```
┌─────────────────────────────────────────────────────────────────┐
│  CTX-SPACE  ·  [Project name ▾]        History · GitHub · Publish │  top bar
├───────────────────────────┬───────────────────────────────────────┤
│  CHAT PANEL (left)         │  OUTPUT PANEL (right)                 │
│  ~38% width                │  ~62% width                           │
│                            │  ┌─ tabs: [ Preview ] [ Code ] ──────┐│
│  • assistant messages      │  │  device: [▭ desktop][▯ mobile]    ││
│    narrating the build     │  │  ↻ refresh   ⇱ open in new tab    ││
│  • interactive "Edit #N"   │  ├───────────────────────────────────┤│
│    cards (expand → diff)   │  │                                   ││
│  • streaming activity      │  │   live preview iframe             ││
│                            │  │   (sandboxed, hot-reloads)        ││
│  ┌──────────────────────┐  │  │                                   ││
│  │ prompt box           │  │  │   — OR —                          ││
│  │ [Visual edits] [send]│  │  │   file tree + code editor         ││
│  └──────────────────────┘  │  └───────────────────────────────────┘│
└───────────────────────────┴───────────────────────────────────────┘
```

### 2.3 Top bar
- Left: **Context Space** wordmark + editable **project name** dropdown.
- Right: **History** (opens the edit timeline), **GitHub** (connect/sync), **Publish** (primary button; opens publish dialog). Account menu far right.

### 2.4 Chat panel (left, ~38%)
- Assistant messages narrate the build in plain language as it happens ("Setting up the project…", "Creating the TodoList component…").
- Each build step renders an interactive **Edit #N** card. Collapsed it shows a one-line summary; **clicking it expands the code diff** for that edit.
- A live **activity indicator** shows the agent's current action so the user is never staring at a blank spinner.
- **Prompt box pinned to the bottom** with a **Visual edits** toggle (v1: present but routed through chat; full click-to-edit is a later phase) and a send button. The first turn shows the plan-approval card (Section 5.2).

### 2.5 Output panel (right, ~62%)
- Tab bar: **Preview** | **Code**.
- **Preview tab:** a sandboxed live iframe of the running app that hot-reloads on every edit. Toolbar: **device-size toggle** (desktop / mobile widths), **refresh**, **open in new tab**.
- **Code tab:** a **file tree** on the left of this panel and a syntax-highlighted **code editor/viewer** on the right (read-only in v1, editable later).

### 2.6 History (edit timeline)
- A list of all edits ("Edit #1 — initial project", "Edit #2 — make header blue"), newest first.
- Each entry has a **Restore** action that reverts the project to that edit's state.

### 2.7 Knowledge / context (optional v1, on-brand for "Context Space")
- A side drawer where the user stores persistent context — design rules, requirements, brand notes — that the agent references on **every** edit. (This maps directly to Lovable's Knowledge Base and is a natural fit for the product name.)

### 2.8 Visual edits mode (later phase)
- Click any element in the live preview → an inline editing panel lets the user change text, color, spacing, and images; changes flow through the agent and produce a reviewable diff.

### 2.9 Responsive across all devices (mandatory)
Context Space must work and look right on **phone, tablet, and desktop**. The side-by-side two-pane layout is desktop-only; on smaller screens it adapts rather than shrinks:

- **Desktop (≥1024px):** the two-pane layout in Section 2.2 (left chat ~38%, right output ~62%), with a draggable splitter.
- **Tablet (640–1023px):** panes stack or the chat collapses to a slide-over drawer; a top toggle switches between **Chat** and **Preview/Code**.
- **Phone (<640px):** single-pane, **tabbed** layout — a bottom or top segmented control switches between **Chat**, **Preview**, and **Code**. The prompt box stays pinned above the keyboard. The device-size toggle defaults to mobile width.
- Touch-friendly targets (≥44px), no hover-only controls, safe-area insets respected.
- Concrete breakpoints to specify in build: `<640` (1-col tabbed), `≥640` (chat drawer + preview), `≥1024` (full two-pane). Use Tailwind's `sm`/`md`/`lg`/`xl` breakpoints throughout.

### 2.10 Progressive Web App (PWA)
Context Space ships as an installable **PWA**:

- **Web app manifest** (`manifest.webmanifest`): name "Context Space", short_name "CTX-SPACE", theme/background colors, `display: standalone`, full icon set (192/512 + maskable), and screenshots for richer install prompts.
- **Service worker** for an installable, offline-capable **app shell** — the builder UI loads offline; the chat/agent and live preview naturally require connectivity, so show a clear offline state for those.
- **Installable** on desktop and mobile (Add to Home Screen / Install app), launches standalone (no browser chrome).
- App icons, splash, and a custom offline fallback page.
- Implementation: `next-pwa` or **Serwist** for the service worker; keep cross-origin isolation headers (Section 5.5) compatible with the SW scope.

> Note: a PWA service worker can interact with the COOP/COEP headers WebContainers needs — scope the SW so it doesn't strip those headers from the preview route. Verify during P3.

> **Optional, separate concern:** the *apps Context Space generates* can also be made responsive-by-default and PWA-capable (the base template can include a manifest + SW). Default the agent to responsive output; make "generate as PWA" an opt-in toggle. Tracked in Section 14.

---

## 3. Target user flow (the exact Lovable flow)

1. **New project.** Centered prompt box → user describes the app → workspace opens.
2. **Chat + plan.** Agent replies with a concise **build plan** and pauses for approval. User clicks **Approve** (or types changes → plan regenerates).
3. **Build with live progress.** Agent generates files one at a time; chat narrates each as an **Edit #N** card; the file tree fills in live.
4. **Live preview.** As soon as the project is runnable, the **Preview** tab shows the running app; follow-up messages ("make the header blue") hot-reload it.
5. **Publish.** **Publish** → connect GitHub → choose repo name + visibility → **Create & push** → show repo URL. Optional deploy after.

The defining feel: the user is *conversing*, and the app materializes beside them in real time, with every step reviewable and restorable.

---

## 4. Architecture (four layers)

```
User prompt
   │
   ▼
[1] CopilotKit chat + plan + progress     ← CopilotKit Cloud (publishable key)
   │
   ▼
[2] LLM code agent (generates files)      ← CopilotKit Cloud default agent now;
   │                                         pluggable custom backend later (AG-UI)
   ▼
[3] Virtual file system → WebContainers   ← you build (StackBlitz @webcontainer/api)
   │      (live preview, hot reload)
   ▼
[4] Publish: GitHub OAuth + push          ← you build (GitHub REST API)
```

- **Layers 1 & 2 (CopilotKit):** chat UI, message streaming, the plan-approval pause (human-in-the-loop), real-time progress (agent shared-state streaming), and tool calls that write files. Powered now by **CopilotKit Cloud** via the publishable key, and architected so the agent connection can later point at a **custom backend** that speaks the **AG-UI protocol** (e.g. a LangGraph or self-hosted model agent) — see Section 10.
- **Layer 3 (you build):** an in-memory virtual file system mirroring what the agent generates, mounted into a **WebContainer** that runs `npm install` + a Vite dev server in-browser and serves the preview iframe.
- **Layer 4 (you build):** GitHub OAuth + REST calls to create a repo and push files; optional deploy.

---

## 5. Feature specification by area

### 5.1 Chat & conversation (CopilotKit)
- A CopilotKit chat surface (e.g. `CopilotChat`) wrapped in `<CopilotKit publicApiKey="ck_pub_…">`, styled as the left panel in Section 2.4.
- Every build action originates from a message. Stream assistant tokens; render each build step as an expandable **Edit #N** card.

### 5.2 Plan mode (human-in-the-loop)
- Before generating files, the agent calls an action that **renders a plan card and waits for the user's response** (CopilotKit human-in-the-loop / render-and-wait pattern).
- Approve → generate. Edit → agent revises and re-prompts.
- Plan card: app name, 3–6 feature bullets, file list preview.

### 5.3 Code generation agent
- The agent emits files via client-side actions (`useCopilotAction`): `writeFile({ path, contents })`, `deleteFile({ path })`.
- Each `writeFile`: (a) updates the virtual file store, (b) appends an **Edit #N** card to chat with an expandable diff, (c) writes into the WebContainer so the preview hot-reloads.
- **Incremental & observable** — one file per tool call so the tree fills in visibly.
- Expose current project state (files, framework, last error) to the agent via `useCopilotReadable` for context-aware follow-up edits.

### 5.4 Real-time progress
- Driven by CopilotKit streaming + shared agent state: a live "current action" indicator plus the chat narration.

### 5.5 Live preview (WebContainers)
- On project init, boot a WebContainer, mount the base **Vite + React + TypeScript + shadcn/ui + Tailwind** template, run `npm install` then `npm run dev`.
- On the `server-ready` event, point the preview iframe at the served URL.
- On each `writeFile`, write into the WebContainer FS; Vite HMR updates the preview.
- **Required:** cross-origin isolation headers (`Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin`) in `next.config.js` — WebContainers won't boot without them.
- Feed install/build errors back into chat so the agent can self-correct.
- Device-size toggle = setting the iframe container width (e.g. 390px mobile / full desktop).
- **Fallback:** if WebContainers is too heavy, swap Layer 3 for **Sandpack** (`@codesandbox/sandpack-react`) — simpler, React-only, no Node backend.

### 5.6 File tree & code viewer (Code tab)
- Collapsible file tree reflecting the virtual FS; clicking a file opens it in a read-only **Monaco**/**CodeMirror** viewer (editable later).

### 5.7 Edit history & restore
- Maintain an ordered list of edits (each a snapshot or diff of the virtual FS).
- **History** panel lists them; **Restore** reverts the FS (and the WebContainer) to that snapshot.

### 5.8 Publish to GitHub
- **Connect GitHub:** OAuth via a GitHub OAuth App / GitHub App; handle the callback in a Next.js API route; store the token in an **httpOnly server session**, never in client JS.
- **Create & push:** Octokit to (1) create the repo, (2) push generated files (tree + commit + ref, or Contents API). On success return `html_url`.
- **Optional:** publishing is never required — user can keep iterating, and can **download a zip** as an alternative.
- **Deploy (later):** a Deploy button triggering Vercel/Netlify from the new repo.

### 5.9 Persistence (optional v1)
- Save each project (chat + file tree + history) so it can be reopened. localStorage for v1; a DB if multi-device.

---

## 6. The code-generation agent system prompt

> Drives Layer 2 — configure as the agent's instructions in CopilotKit Cloud (or your custom backend later).

```
You are Context Space (CTX-SPACE), an expert AI software engineer that builds web
apps from a user's description through conversation.

OUTPUT TARGET (do not deviate):
- Every app you build is a Vite + React + TypeScript + Tailwind CSS project using
  shadcn/ui components. Install additional well-known npm packages only when needed.
- Use the provided base template. Only create/edit files inside it.

WORKFLOW (always in this order):
1. PLAN: When the user describes an app, do NOT write code yet. Call `proposePlan`
   with an app name, 3–6 feature bullets, and the list of files you will create.
   Then stop and wait for the user's approval.
2. On approval, BUILD: create files one at a time via `writeFile({path, contents})`.
   - One file per call so the user sees progress as separate edits.
   - Order: entry/structure → components → styling.
   - Write complete, runnable file contents — never placeholders or "// TODO".
3. After building, briefly summarize what you made and suggest 2–3 next tweaks.

EDITS: For follow-up requests, read the current files (provided as context), then
call `writeFile` only for the files that change. Never rewrite the whole project
for a small edit. Each edit should read as a clear "Edit #N" with a small diff.

ERRORS: If the build/preview reports an error (provided as context), diagnose and
fix it by editing the offending file. Explain the fix in one sentence.

CONTEXT: Always respect the user's Knowledge / context notes (design rules, brand,
requirements) if provided — apply them to every edit.

STYLE: Clean, modern, responsive UIs by default — every generated app must work on
phone, tablet, and desktop (use Tailwind breakpoints; mobile-first). Sensible empty
states. Accessible markup. Don't over-explain in chat — let the preview speak.

CONSTRAINTS: No backend services, auth providers, or paid APIs in v1. Everything
client-side and runnable in a browser sandbox.
```

---

## 7. Tech stack (the builder app itself)

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Builder UI + GitHub OAuth API routes. |
| AI / chat | **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`) | Cloud agent via publishable key. |
| Styling | **Tailwind CSS** + **shadcn/ui** | Builder's own UI. |
| Live preview | **WebContainers** (`@webcontainer/api`) | Node + Vite in-browser; needs COOP/COEP headers. |
| Code viewer | **Monaco** or **CodeMirror** | Read-only in v1. |
| Publish | **GitHub REST API** via **Octokit** | OAuth in a Next.js route. |
| State | **Zustand** | Virtual file tree, chat, history, build status. |
| Responsive UI | **Tailwind breakpoints** (`sm`/`md`/`lg`/`xl`) | Tabbed single-pane on phone → two-pane on desktop (Section 2.9). |
| PWA | **`next-pwa`** or **Serwist** + web manifest | Installable, offline app shell, icons (Section 2.10). |
| Persistence (optional) | localStorage or light DB | Save/restore projects. |

> The **generated apps** target a fixed, WebContainer-friendly template — **Vite + React + TS + shadcn/ui + Tailwind** — matching Lovable's stack. Constraining output to one known-good template greatly improves reliability.

---

## 8. CopilotKit integration details

- **Provider:** `<CopilotKit publicApiKey="ck_pub_…">`. (Publishable keys are for the browser; keep any *secret* keys server-side only.)
- **Chat UI:** `CopilotChat`/`CopilotSidebar` from the React UI package. CopilotKit shipped a v2 chat API (`@copilotkit/react-core/v2`) — confirm component/import names against docs.copilotkit.ai before wiring.
- **Actions:** `useCopilotAction` for `proposePlan` (render-and-wait approval), `writeFile`, `deleteFile`.
- **Context:** `useCopilotReadable` to expose file tree, framework, latest preview error, and Knowledge notes.
- **Progress:** render the agent's streaming state for the live activity indicator.

> Verify exact hook/prop signatures against current CopilotKit docs — the API versioned recently. Architecture is unchanged; only import paths/prop names may differ.

---

## 9. Pluggable code-gen backend (now vs later)

**Now:** CopilotKit Cloud's default agent with the publishable key. No backend to run.

**Later (custom backend):** CopilotKit talks to agents over the **AG-UI protocol**, so the same frontend can point at your own agent without a UI rewrite. Design for it from day one:
- One config: `AGENT_MODE = "cloud" | "custom"`.
- `cloud` → publishable key + default agent.
- `custom` → a self-hosted agent endpoint (LangGraph, or your own model loop) speaking AG-UI; the frontend's actions/state hooks stay identical.
- Keep all tool definitions (`writeFile`, `proposePlan`, …) framework-agnostic.

---

## 10. Implementation phases

1. **P1 — Chat shell:** Next.js + CopilotKit provider + landing prompt screen + workspace shell (top bar, left chat, right empty panel with Preview/Code tabs).
2. **P2 — Plan + generate:** `proposePlan` (approval pause) + `writeFile` into a virtual file store + Edit #N cards with diffs + file tree + code viewer.
3. **P3 — Live preview:** WebContainer boot, mount template, install, dev server, iframe preview, HMR on `writeFile`, device-size toggle, errors fed back to chat.
4. **P4 — Publish + history:** GitHub OAuth + Octokit create/push + success UI; zip download fallback; edit history with Restore.
4b. **Responsive + PWA (build alongside P1–P4, harden by P4):** responsive breakpoints from P1 (don't bolt on later); add the manifest, icons, service worker, and offline shell; verify install on desktop + mobile and SW/COOP-COEP compatibility.
5. **P5 (later):** custom AG-UI backend, visual edits mode, Knowledge drawer, deploy button, Supabase/backend generation, themes, PWA-output toggle for generated apps.

---

## 11. Acceptance criteria (v1)

- [ ] Landing prompt box creates a project and opens the Lovable-style workspace (left chat, right Preview/Code).
- [ ] User receives a build plan, then approves it.
- [ ] On approval, files stream in as separate **Edit #N** cards; file tree fills live.
- [ ] Clicking an Edit card expands its code diff.
- [ ] Live preview iframe shows the running app and hot-reloads on edits; device-size toggle works.
- [ ] Follow-up messages produce incremental edits, not full rewrites.
- [ ] Build/preview errors are surfaced and the agent can fix them.
- [ ] History lists edits and Restore reverts the project.
- [ ] User can publish to a new GitHub repo and get the repo URL; zip download available as an alternative.
- [ ] Agent connection is behind a config flag so a custom AG-UI backend can be added later without UI changes.
- [ ] UI is fully usable on phone, tablet, and desktop — tabbed single-pane on phone, two-pane on desktop, no broken/overflowing layouts.
- [ ] App is installable as a PWA on desktop and mobile, launches standalone, and serves an offline app shell with a clear offline state for online-only features.

---

## 12. Key risks & mitigations

- **WebContainers won't boot** → set COOP/COEP headers in `next.config.js`.
- **Non-runnable config generated** → constrain output to one fixed Vite+React+TS+shadcn+Tailwind template; agent edits app files only, never build config.
- **Big-blob generation feels frozen** → enforce one-file-per-tool-call.
- **Secret leakage** → only the publishable CopilotKit key is client-side; GitHub tokens stay in an httpOnly server session.
- **API drift** → confirm CopilotKit component/hook names against current docs before coding.

---

## 13. Open questions to confirm before/while building

- Persist projects across sessions in v1, or single in-memory session?
- Public or private GitHub repos by default?
- Include the optional deploy step (Vercel/Netlify) in the first build, or strictly later?
- Branding details for Context Space — exact wordmark style, colors, logo?
- Include the Knowledge / context drawer in v1 (it's an on-brand fit for "Context Space"), or defer to P5?

---

## 14. Out of scope for v1 (Lovable parity backlog)

Supabase backend + auth provisioning, Stripe wiring, full visual click-to-edit mode, design themes/tokens panel, in-app image generation, multiplayer collaboration, template library, multi-page routing scaffolds, mobile/native export.