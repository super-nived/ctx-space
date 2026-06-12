"""Project CRUD API — proxies to PocketBase (admin creds stay server-side).

The frontend saves/loads each project (files + chat messages + thread) here so
projects persist across refresh AND across devices, and users can switch between
multiple past projects (Lovable-style history).

Routes (all under /api/projects):
  GET    /                 list projects for the owner (lightweight)
  POST   /                 create a project
  GET    /{id}             full project (files + messages)
  PATCH  /{id}             update a project
  DELETE /{id}             delete a project
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.pocketbase import PocketBaseClient

router = APIRouter(prefix="/api/projects", tags=["projects"])
_pb = PocketBaseClient(get_settings())

# A single-user local setup uses a constant owner; swap for real auth later.
DEFAULT_OWNER = "default"


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0


class ProjectUpsert(BaseModel):
    name: str = "Untitled"
    owner: str = DEFAULT_OWNER
    files: dict[str, Any] = Field(default_factory=dict)
    messages: list[Any] = Field(default_factory=list)
    thread_id: str | None = None
    preview_entry: str | None = None
    token_usage: dict[str, Any] = Field(default_factory=dict)


class ProjectPatch(BaseModel):
    name: str | None = None
    files: dict[str, Any] | None = None
    messages: list[Any] | None = None
    preview_entry: str | None = None
    token_usage: dict[str, Any] | None = None


@router.get("")
async def list_projects(owner: str = DEFAULT_OWNER) -> list[dict[str, Any]]:
    try:
        return await _pb.list_projects(owner)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"PocketBase error: {exc}") from exc


@router.post("")
async def create_project(body: ProjectUpsert) -> dict[str, Any]:
    try:
        return await _pb.create_project(body.model_dump(exclude_none=True))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"PocketBase error: {exc}") from exc


@router.get("/{project_id}")
async def get_project(project_id: str) -> dict[str, Any]:
    try:
        return await _pb.get_project(project_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"Not found: {exc}") from exc


@router.patch("/{project_id}")
async def update_project(project_id: str, body: ProjectPatch) -> dict[str, Any]:
    try:
        return await _pb.update_project(project_id, body.model_dump(exclude_none=True))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"PocketBase error: {exc}") from exc


@router.delete("/{project_id}")
async def delete_project(project_id: str) -> dict[str, str]:
    try:
        await _pb.delete_project(project_id)
        return {"deleted": project_id}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"PocketBase error: {exc}") from exc
