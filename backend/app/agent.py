"""The Context Space code-generation agent, exposed as an AG-UI event stream.

Translates an AG-UI ``RunAgentInput`` into an OpenAI chat-completions streaming
call and re-emits the result as AG-UI events:

    RUN_STARTED
      -> TEXT_MESSAGE_START / _CONTENT* / _END    (assistant prose)
      -> TOOL_CALL_START / _ARGS* / _END           (frontend tools: writeFile, ...)
    RUN_FINISHED   (or RUN_ERROR on failure)

Two kinds of tools reach the model:
  * Frontend tools (proposePlan / writeFile / deleteFile) arrive in
    ``RunAgentInput.tools``. We DO NOT execute these — we surface them as
    TOOL_CALL_* events and the browser runs them (writing into the WebContainer).
  * DataSpace MCP tools are discovered server-side and executed here; their results
    are looped back into the model so it can keep reasoning.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from ag_ui.core import (
    EventType,
    RunAgentInput,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallStartEvent,
)
from ag_ui.encoder import EventEncoder
from openai import AsyncOpenAI

from app.config import Settings
from app.mcp_client import McpClient
from app.prompts import SYSTEM_PROMPT

# Guard against runaway tool loops (model <-> MCP) within a single run.
_MAX_TOOL_ROUNDS = 8


def _convert_content(content: Any) -> Any:
    """Convert AG-UI message content to OpenAI's format.

    AG-UI content is either a plain string or a list of typed input parts
    (text / image / …). For multimodal messages we map each part to OpenAI's
    content-part shape so vision-capable models (gpt-5) can SEE attached images.
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return str(content)

    parts: list[dict[str, Any]] = []
    for part in content:
        ptype = getattr(part, "type", None) or (
            part.get("type") if isinstance(part, dict) else None
        )
        if ptype == "text":
            text = getattr(part, "text", None) or (
                part.get("text") if isinstance(part, dict) else ""
            )
            parts.append({"type": "text", "text": text or ""})
        elif ptype == "image":
            source = getattr(part, "source", None) or (
                part.get("source") if isinstance(part, dict) else None
            )
            if source is None:
                continue
            stype = getattr(source, "type", None) or (
                source.get("type") if isinstance(source, dict) else None
            )
            value = getattr(source, "value", None) or (
                source.get("value") if isinstance(source, dict) else None
            )
            mime = (
                getattr(source, "mime_type", None)
                or (source.get("mime_type") if isinstance(source, dict) else None)
                or "image/png"
            )
            if not value:
                continue
            # data source -> data URL; url source -> the URL as-is.
            url = value if stype == "url" else f"data:{mime};base64,{value}"
            parts.append({"type": "image_url", "image_url": {"url": url}})
        # Other modalities (audio/video/doc) are ignored for now.
    return parts or ""


def _ag_messages_to_openai(messages: list[Any]) -> list[dict[str, Any]]:
    """Convert AG-UI messages into OpenAI chat-completion message dicts."""
    out: list[dict[str, Any]] = []
    for msg in messages:
        role = getattr(msg, "role", None)
        if role in ("user", "system", "developer", "assistant"):
            entry: dict[str, Any] = {
                "role": "system" if role == "developer" else role,
                "content": _convert_content(getattr(msg, "content", "")),
            }
            tool_calls = getattr(msg, "tool_calls", None)
            if role == "assistant" and tool_calls:
                entry["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls
                ]
            out.append(entry)
        elif role == "tool":
            out.append(
                {
                    "role": "tool",
                    "tool_call_id": getattr(msg, "tool_call_id", ""),
                    "content": getattr(msg, "content", "") or "",
                }
            )
    return _sanitize_tool_calls(out)


def _sanitize_tool_calls(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Make a message list valid for OpenAI's tool-call rules.

    OpenAI requires that every assistant ``tool_calls`` entry is immediately
    answered by a ``tool`` message for each tool_call_id, and that every ``tool``
    message refers to a preceding tool_call. Conversations restored from storage
    can be saved mid-build (a writeFile tool call whose client-side result wasn't
    persisted), which would make OpenAI 400. We:
      * collect every tool_call_id that HAS a matching tool result,
      * drop unanswered tool_calls from assistant messages (and the message if it
        then has no content and no tool_calls),
      * drop orphan tool messages that reference an unknown tool_call_id.
    """
    answered: set[str] = {
        m["tool_call_id"]
        for m in messages
        if m.get("role") == "tool" and m.get("tool_call_id")
    }

    cleaned: list[dict[str, Any]] = []
    for m in messages:
        if m.get("role") == "assistant" and m.get("tool_calls"):
            kept = [tc for tc in m["tool_calls"] if tc.get("id") in answered]
            new_msg = dict(m)
            if kept:
                new_msg["tool_calls"] = kept
            else:
                new_msg.pop("tool_calls", None)
            # Drop an assistant message that ends up with neither content nor calls.
            if not new_msg.get("tool_calls") and not (new_msg.get("content") or "").strip():
                continue
            cleaned.append(new_msg)
        elif m.get("role") == "tool":
            # Keep only tool results whose call survived above.
            if m.get("tool_call_id") in answered:
                cleaned.append(m)
        else:
            cleaned.append(m)
    return cleaned


def _frontend_tools_to_openai(tools: list[Any]) -> list[dict[str, Any]]:
    """Convert AG-UI frontend Tool definitions into OpenAI function tools."""
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description or "",
                "parameters": t.parameters or {"type": "object", "properties": {}},
            },
        }
        for t in tools
    ]


class CtxSpaceAgent:
    """Stateless agent: each ``run`` is one AG-UI request/response cycle."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._mcp = McpClient(settings.mcp_server_url, settings.mcp_server_label)

    async def _load_mcp_tools(self) -> list[dict[str, Any]]:
        """Discover DataSpace MCP tools; degrade gracefully if unreachable."""
        try:
            return await self._mcp.list_tools()
        except Exception:  # noqa: BLE001 — MCP being down must not kill the run.
            return []

    def _is_mcp_tool(self, name: str) -> bool:
        return name.startswith(f"{self._settings.mcp_server_label}__")

    async def run(self, run_input: RunAgentInput, accept: str | None) -> AsyncIterator[str]:
        """Yield SSE-encoded AG-UI events for one agent run."""
        encoder = EventEncoder(accept=accept)

        yield encoder.encode(
            RunStartedEvent(
                type=EventType.RUN_STARTED,
                thread_id=run_input.thread_id,
                run_id=run_input.run_id,
            )
        )

        try:
            mcp_tools = await self._load_mcp_tools()
            frontend_tools = _frontend_tools_to_openai(run_input.tools or [])
            all_tools = frontend_tools + mcp_tools

            messages: list[dict[str, Any]] = [
                {"role": "system", "content": SYSTEM_PROMPT},
                *_ag_messages_to_openai(run_input.messages),
            ]

            async for event in self._run_loop(encoder, messages, all_tools):
                yield event

            yield encoder.encode(
                RunFinishedEvent(
                    type=EventType.RUN_FINISHED,
                    thread_id=run_input.thread_id,
                    run_id=run_input.run_id,
                )
            )
        except Exception as exc:  # noqa: BLE001 — surface any failure to the client.
            yield encoder.encode(
                RunErrorEvent(type=EventType.RUN_ERROR, message=str(exc))
            )

    async def _run_loop(
        self,
        encoder: EventEncoder,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
    ) -> AsyncIterator[str]:
        """Stream the model; resolve MCP tools server-side; emit frontend tool calls.

        Frontend tool calls (writeFile/proposePlan/deleteFile) terminate the round —
        the browser executes them and sends results back as a new run, so we stop
        and let the client take over. MCP tool calls are resolved here and the loop
        continues so the model can use the data.
        """
        for _ in range(_MAX_TOOL_ROUNDS):
            stream = await self._client.chat.completions.create(
                model=self._settings.openai_model,
                messages=messages,
                tools=tools or None,
                stream=True,
            )

            text_id: str | None = None
            # tool_call index -> accumulated {id, name, args}
            calls: dict[int, dict[str, str]] = {}

            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # --- streamed assistant text ---
                if getattr(delta, "content", None):
                    if text_id is None:
                        text_id = str(uuid.uuid4())
                        yield encoder.encode(
                            TextMessageStartEvent(
                                type=EventType.TEXT_MESSAGE_START,
                                message_id=text_id,
                                role="assistant",
                            )
                        )
                    yield encoder.encode(
                        TextMessageContentEvent(
                            type=EventType.TEXT_MESSAGE_CONTENT,
                            message_id=text_id,
                            delta=delta.content,
                        )
                    )

                # --- streamed tool-call fragments ---
                for tc in getattr(delta, "tool_calls", None) or []:
                    slot = calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function and tc.function.name:
                        slot["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        slot["args"] += tc.function.arguments

            if text_id is not None:
                yield encoder.encode(
                    TextMessageEndEvent(
                        type=EventType.TEXT_MESSAGE_END, message_id=text_id
                    )
                )

            if not calls:
                return  # plain text answer; the run is complete.

            # Split this round's tool calls into MCP (resolve here) vs frontend (emit).
            mcp_calls = {i: c for i, c in calls.items() if self._is_mcp_tool(c["name"])}
            frontend_calls = {
                i: c for i, c in calls.items() if not self._is_mcp_tool(c["name"])
            }

            if frontend_calls:
                # Emit frontend tool calls and hand control to the browser.
                for call in frontend_calls.values():
                    async for event in self._emit_frontend_tool(encoder, call):
                        yield event
                return

            # Only MCP calls: resolve them, append results, loop again.
            messages.append(
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "id": c["id"],
                            "type": "function",
                            "function": {"name": c["name"], "arguments": c["args"] or "{}"},
                        }
                        for c in mcp_calls.values()
                    ],
                }
            )
            for call in mcp_calls.values():
                result = await self._resolve_mcp(call)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": result,
                    }
                )
            # ... continue the loop so the model can use the MCP results.

    async def _emit_frontend_tool(
        self, encoder: EventEncoder, call: dict[str, str]
    ) -> AsyncIterator[str]:
        """Emit a complete TOOL_CALL_* sequence for a browser-executed tool."""
        tool_call_id = call["id"] or str(uuid.uuid4())
        yield encoder.encode(
            ToolCallStartEvent(
                type=EventType.TOOL_CALL_START,
                tool_call_id=tool_call_id,
                tool_call_name=call["name"],
            )
        )
        yield encoder.encode(
            ToolCallArgsEvent(
                type=EventType.TOOL_CALL_ARGS,
                tool_call_id=tool_call_id,
                delta=call["args"] or "{}",
            )
        )
        yield encoder.encode(
            ToolCallEndEvent(type=EventType.TOOL_CALL_END, tool_call_id=tool_call_id)
        )

    async def _resolve_mcp(self, call: dict[str, str]) -> str:
        """Execute an MCP tool call and return its textual result."""
        label_prefix = f"{self._settings.mcp_server_label}__"
        bare_name = call["name"][len(label_prefix) :]
        try:
            args = json.loads(call["args"]) if call["args"] else {}
        except json.JSONDecodeError:
            args = {}
        try:
            return await self._mcp.call_tool(bare_name, args)
        except Exception as exc:  # noqa: BLE001 — report tool failure to the model.
            return f"MCP tool '{bare_name}' failed: {exc}"
