# Context Space — Backend (AG-UI Agent)

FastAPI service that powers the Context Space builder. It exposes the
code-generation agent over the **AG-UI protocol**, driven by OpenAI and the
DataSpace MCP server. The React frontend connects here via CopilotKit /
`@ag-ui/client`.

## Layout

```
app/
  config.py      Settings (env-driven; secrets never hard-coded)
  prompts.py     The CTX-SPACE system prompt
  mcp_client.py  Minimal MCP JSON-RPC client for DataSpace
  agent.py       RunAgentInput -> OpenAI stream -> AG-UI events
  main.py        FastAPI app (POST / agent run, GET /health)
tests/           Offline unit tests (OpenAI + MCP mocked)
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in a freshly ROTATED OpenAI key
```

> **Security:** the previously committed OpenAI key is compromised — rotate it at
> the OpenAI dashboard before running. Never commit `.env`.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- `GET  /health` — liveness probe
- `POST /` — AG-UI agent run (SSE stream of AG-UI events)

## Test / lint

```bash
pytest -q
ruff check app/
```

## How it works

Frontend tools (`proposePlan`, `writeFile`, `deleteFile`) arrive in
`RunAgentInput.tools` and are **emitted** as AG-UI `TOOL_CALL_*` events — the
browser executes them (writing into the WebContainer). DataSpace MCP tools are
discovered and **resolved server-side**, looping their results back into the
model. See `../build-plan.md` for the full architecture.
