"""FastAPI application exposing the Context Space agent over AG-UI.

Endpoints:
  POST /            -> AG-UI agent run (CopilotKit / @ag-ui/client connect here)
  GET  /health      -> liveness probe

GitHub OAuth routes for the Publish feature are added in P4.
"""

from __future__ import annotations

from ag_ui.core import RunAgentInput
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.agent import CtxSpaceAgent
from app.config import get_settings
from app.projects import router as projects_router

settings = get_settings()
agent = CtxSpaceAgent(settings)

# In-memory usage store: thread_id -> cumulative {input_tokens, output_tokens, cost_usd}
# Cleared on server restart; frontend persists to PocketBase after reading.
_usage: dict[str, dict[str, float]] = {}

app = FastAPI(title="Context Space Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Project storage (PocketBase-backed) for multi-project history.
app.include_router(projects_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "model": settings.openai_model}


@app.get("/api/usage")
def get_usage(thread_id: str) -> dict[str, float]:
    """Return cumulative token usage for a thread (fetched by frontend after run ends)."""
    return _usage.get(thread_id, {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})


async def _run_and_track(run_input: RunAgentInput, accept: str | None):
    """Wrap agent.run() and capture the USAGE frame into _usage."""
    tid = run_input.thread_id
    async for chunk in agent.run(run_input, accept):
        yield chunk
        # Parse our custom USAGE SSE frame to update the server-side store.
        if chunk.startswith("data:"):
            try:
                import json as _json
                ev = _json.loads(chunk[5:].strip())
                if ev.get("type") == "USAGE":
                    prev = _usage.get(tid, {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})
                    _usage[tid] = {
                        "input_tokens": prev["input_tokens"] + ev["input_tokens"],
                        "output_tokens": prev["output_tokens"] + ev["output_tokens"],
                        "cost_usd": prev["cost_usd"] + ev["cost_usd"],
                    }
            except Exception:  # noqa: BLE001
                pass


@app.post("/")
async def agent_endpoint(run_input: RunAgentInput, request: Request) -> StreamingResponse:
    """AG-UI agent run endpoint: stream AG-UI events as SSE."""
    accept = request.headers.get("accept")
    return StreamingResponse(
        _run_and_track(run_input, accept),
        media_type="text/event-stream",
    )
