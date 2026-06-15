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

from app.config import get_settings
from app.projects import router as projects_router

settings = get_settings()


def _build_agent(cfg):
    """Select the LLM backend from settings.llm_provider.

    "claude" -> CtxSpaceClaudeAgent (Agent SDK, subscription auth) — default on
                 the ctx-space-claude branch.
    "openai" -> CtxSpaceAgent (OpenAI chat-completions) — parity with main.
    Both expose the same run()/_last_usage contract, so main.py is provider-agnostic.
    """
    provider = (cfg.llm_provider or "claude").strip().lower()
    if provider == "openai":
        from app.agent import CtxSpaceAgent

        return CtxSpaceAgent(cfg)
    from app.agent_claude import CtxSpaceClaudeAgent

    return CtxSpaceClaudeAgent(cfg)


agent = _build_agent(settings)

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
    provider = (settings.llm_provider or "claude").strip().lower()
    model = settings.claude_model if provider == "claude" else settings.openai_model
    return {"status": "ok", "provider": provider, "model": model}


@app.get("/api/usage")
def get_usage(thread_id: str) -> dict[str, float]:
    """Return cumulative token usage for a thread (fetched by frontend after run ends)."""
    return _usage.get(thread_id, {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})


async def _run_and_track(run_input: RunAgentInput, accept: str | None):
    """Wrap agent.run() and update _usage from agent._last_usage after the stream ends.

    The USAGE data is stored on the agent instance after RUN_FINISHED — we never
    emit it as a raw SSE frame (that would confuse CopilotKit's event discriminator).
    """
    tid = run_input.thread_id
    async for chunk in agent.run(run_input, accept):
        yield chunk
    # After the generator is exhausted (RUN_FINISHED was emitted), read the
    # usage that agent.run() stored on self._last_usage.
    usage = getattr(agent, "_last_usage", None)
    if usage:
        prev = _usage.get(tid, {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})
        _usage[tid] = {
            "input_tokens": prev["input_tokens"] + usage["input_tokens"],
            "output_tokens": prev["output_tokens"] + usage["output_tokens"],
            "cost_usd": prev["cost_usd"] + usage["cost_usd"],
        }


@app.post("/")
async def agent_endpoint(run_input: RunAgentInput, request: Request) -> StreamingResponse:
    """AG-UI agent run endpoint: stream AG-UI events as SSE."""
    accept = request.headers.get("accept")
    return StreamingResponse(
        _run_and_track(run_input, accept),
        media_type="text/event-stream",
    )
