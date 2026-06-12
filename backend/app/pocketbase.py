"""Thin PocketBase client for project storage.

Authenticates as an admin (server-side only — the token never reaches the
browser) and performs CRUD on the ctx_space_projects collection. The admin
token is cached and refreshed on 401.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings


class PocketBaseClient:
    def __init__(self, settings: Settings) -> None:
        self._base = settings.pocketbase_url.rstrip("/")
        self._email = settings.pocketbase_email
        self._password = settings.pocketbase_password
        self._collection = settings.pocketbase_collection
        self._token: str | None = None

    @property
    def _records_url(self) -> str:
        return f"{self._base}/api/collections/{self._collection}/records"

    async def _auth(self, client: httpx.AsyncClient) -> str:
        """Admin auth (PocketBase <=0.22 uses /api/admins)."""
        resp = await client.post(
            f"{self._base}/api/admins/auth-with-password",
            json={"identity": self._email, "password": self._password},
        )
        resp.raise_for_status()
        self._token = resp.json()["token"]
        return self._token

    async def _headers(self, client: httpx.AsyncClient) -> dict[str, str]:
        if not self._token:
            await self._auth(client)
        return {"Authorization": self._token or ""}

    async def _request(
        self, method: str, url: str, *, json: Any | None = None, params: Any | None = None
    ) -> httpx.Response:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = await self._headers(client)
            resp = await client.request(method, url, json=json, params=params, headers=headers)
            if resp.status_code == 401:
                # Token expired — re-auth once and retry.
                await self._auth(client)
                headers = {"Authorization": self._token or ""}
                resp = await client.request(
                    method, url, json=json, params=params, headers=headers
                )
            resp.raise_for_status()
            return resp

    async def list_projects(self, owner: str) -> list[dict[str, Any]]:
        """Return projects for an owner, newest first (lightweight fields only)."""
        resp = await self._request(
            "GET",
            self._records_url,
            params={
                "filter": f'owner="{owner}"',
                "sort": "-updated",
                "perPage": 100,
                "fields": "id,name,thread_id,updated,created,token_usage",
            },
        )
        return resp.json().get("items", [])

    async def get_project(self, project_id: str) -> dict[str, Any]:
        resp = await self._request("GET", f"{self._records_url}/{project_id}")
        return resp.json()

    async def create_project(self, data: dict[str, Any]) -> dict[str, Any]:
        resp = await self._request("POST", self._records_url, json=data)
        return resp.json()

    async def update_project(self, project_id: str, data: dict[str, Any]) -> dict[str, Any]:
        resp = await self._request("PATCH", f"{self._records_url}/{project_id}", json=data)
        return resp.json()

    async def delete_project(self, project_id: str) -> None:
        await self._request("DELETE", f"{self._records_url}/{project_id}")
