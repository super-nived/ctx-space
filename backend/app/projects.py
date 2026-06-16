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
from app.deploy import deploy_to_netlify, deploy_to_render
from app.github import push_project_to_github
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


class PublishRequest(BaseModel):
    commit_message: str | None = None


@router.post("/{project_id}/publish")
async def publish_project(project_id: str, body: PublishRequest = PublishRequest()) -> dict[str, str]:
    """Push all project files to GitHub as a new (or updated) repo.

    Uses GITHUB_TOKEN + GITHUB_USERNAME from .env — no user auth required.
    Returns the GitHub repo URL and saves it back to the project record.
    """
    settings = get_settings()

    if not settings.github_token or not settings.github_username:
        raise HTTPException(
            status_code=503,
            detail="GitHub publish not configured. Set GITHUB_TOKEN and GITHUB_USERNAME in .env.",
        )

    # Load the full project (files + name)
    try:
        project = await _pb.get_project(project_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"Project not found: {exc}") from exc

    files: dict[str, str] = project.get("files", {})
    if not files:
        raise HTTPException(status_code=400, detail="No files to publish yet.")

    project_name: str = project.get("name", "Untitled")
    commit_message: str = body.commit_message or f"Update {project_name} via Context Space"

    try:
        result = await push_project_to_github(
            token=settings.github_token,
            github_username=settings.github_username,
            project_name=project_name,
            project_id=project_id,
            files=files,
            commit_message=commit_message,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"GitHub push failed: {exc}") from exc

    # Persist the repo URL back to the project record
    try:
        await _pb.update_project(project_id, {"github_url": result["repo_url"]})
    except Exception:  # noqa: BLE001
        pass  # Non-fatal — URL is returned to the frontend either way

    return result


# ── Deploy ─────────────────────────────────────────────────────────────────────

class DeployRequest(BaseModel):
    target: str = "netlify"  # "netlify" | "render" | "both"


@router.post("/{project_id}/deploy")
async def deploy_project(project_id: str, body: DeployRequest = DeployRequest()) -> dict[str, Any]:
    """Deploy the project to Netlify (frontend) and optionally Render (middleware).

    Netlify: we build the project ourselves and upload the static dist/ output —
    no GitHub publish required. Render: deploys from the GitHub repo, so publish
    first (see /publish above).

    Stores deploy URLs back to the project record in PocketBase.
    """
    settings = get_settings()

    project = await _pb.get_project(project_id)
    project_name: str = project.get("name", "Untitled")
    github_url: str = project.get("github_url", "")
    files: dict[str, str] = project.get("files", {})

    # Existing deploy IDs (for re-deploy without creating new sites)
    existing_netlify_id: str | None = project.get("netlify_site_id") or None
    existing_render_id: str | None = project.get("render_service_id") or None

    result: dict[str, Any] = {}

    # ── Netlify ──
    if body.target in ("netlify", "both"):
        if not settings.netlify_token:
            raise HTTPException(status_code=503, detail="NETLIFY_TOKEN not configured.")
        if not files:
            raise HTTPException(status_code=400, detail="No files to deploy yet.")
        try:
            netlify = await deploy_to_netlify(
                token=settings.netlify_token,
                project_name=project_name,
                project_id=project_id,
                files=files,
                existing_site_id=existing_netlify_id,
            )
            result["netlify"] = netlify
            await _pb.update_project(project_id, {
                "netlify_site_id": netlify["site_id"],
                "netlify_url": netlify["site_url"],
            })
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Netlify deploy failed: {exc}") from exc

    # ── Render ──
    if body.target in ("render", "both"):
        if not settings.render_token:
            raise HTTPException(status_code=503, detail="RENDER_TOKEN not configured.")
        if not github_url:
            raise HTTPException(
                status_code=400,
                detail="Publish to GitHub first — Render deploys from your repo.",
            )
        try:
            render = await deploy_to_render(
                token=settings.render_token,
                project_name=project_name,
                project_id=project_id,
                github_repo_url=github_url,
                existing_service_id=existing_render_id,
            )
            result["render"] = render
            await _pb.update_project(project_id, {
                "render_service_id": render["service_id"],
                "render_url": render["service_url"],
            })
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Render deploy failed: {exc}") from exc

    return result
