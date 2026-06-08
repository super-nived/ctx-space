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

settings = get_settings()
agent = CtxSpaceAgent(settings)

app = FastAPI(title="Context Space Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "model": settings.openai_model}


@app.post("/")
async def agent_endpoint(run_input: RunAgentInput, request: Request) -> StreamingResponse:
    """AG-UI agent run endpoint: stream AG-UI events as SSE."""
    accept = request.headers.get("accept")
    return StreamingResponse(
        agent.run(run_input, accept),
        media_type="text/event-stream",
    )
