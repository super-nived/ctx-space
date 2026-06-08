"""Minimal MCP (Model Context Protocol) HTTP client.

Talks to the DataSpace MCP server over streamable HTTP / JSON-RPC so the agent can
(1) discover available tools and (2) call them. We keep this dependency-light
(httpx only) rather than pulling a full MCP SDK, since we only need tools/list and
tools/call.

The DataSpace MCP server is expected to speak the standard MCP JSON-RPC methods:
  - ``initialize``
  - ``tools/list``
  - ``tools/call``
"""

from __future__ import annotations

import json
from typing import Any

import httpx

# MCP streamable-HTTP servers may respond with SSE; accept both.
_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}


class McpError(RuntimeError):
    """Raised when the MCP server returns a JSON-RPC error."""


class McpClient:
    """Stateless-ish JSON-RPC client for a single MCP server URL."""

    def __init__(self, url: str, label: str, timeout: float = 60.0) -> None:
        self.url = url
        self.label = label
        self._timeout = timeout
        self._session_id: str | None = None
        self._next_id = 0

    def _rpc_id(self) -> int:
        self._next_id += 1
        return self._next_id

    @staticmethod
    def _parse_body(resp: httpx.Response) -> dict[str, Any]:
        """Parse a JSON-RPC response that may be plain JSON or SSE-framed."""
        ctype = resp.headers.get("content-type", "")
        if "text/event-stream" in ctype:
            # Take the last ``data:`` line — the final JSON-RPC message.
            payload: dict[str, Any] = {}
            for line in resp.text.splitlines():
                line = line.strip()
                if line.startswith("data:"):
                    chunk = line[len("data:") :].strip()
                    if chunk:
                        payload = json.loads(chunk)
            return payload
        return resp.json()

    async def _request(
        self, client: httpx.AsyncClient, method: str, params: dict[str, Any] | None
    ) -> dict[str, Any]:
        body = {
            "jsonrpc": "2.0",
            "id": self._rpc_id(),
            "method": method,
            "params": params or {},
        }
        headers = dict(_HEADERS)
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id

        resp = await client.post(self.url, json=body, headers=headers)
        resp.raise_for_status()

        # Capture the session id handed back on initialize.
        if not self._session_id and "Mcp-Session-Id" in resp.headers:
            self._session_id = resp.headers["Mcp-Session-Id"]

        data = self._parse_body(resp)
        if "error" in data and data["error"]:
            raise McpError(str(data["error"]))
        return data.get("result", {})

    async def list_tools(self) -> list[dict[str, Any]]:
        """Return the MCP server's tools as OpenAI-style function tool dicts."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            await self._request(
                client,
                "initialize",
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "ctx-space", "version": "0.1.0"},
                },
            )
            result = await self._request(client, "tools/list", {})

        tools: list[dict[str, Any]] = []
        for tool in result.get("tools", []):
            tools.append(
                {
                    "type": "function",
                    "function": {
                        # Namespace MCP tools so they never collide with frontend tools.
                        "name": f"{self.label}__{tool['name']}",
                        "description": tool.get("description", ""),
                        "parameters": tool.get("inputSchema")
                        or {"type": "object", "properties": {}},
                    },
                }
            )
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """Call an MCP tool by its un-namespaced name; return text content."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            await self._request(
                client,
                "initialize",
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "ctx-space", "version": "0.1.0"},
                },
            )
            result = await self._request(
                client, "tools/call", {"name": name, "arguments": arguments}
            )

        # MCP returns content as a list of blocks; concatenate text blocks.
        parts: list[str] = []
        for block in result.get("content", []):
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
            else:
                parts.append(json.dumps(block))
        return "\n".join(parts) if parts else json.dumps(result)
