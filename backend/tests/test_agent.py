"""Tests for the AG-UI agent: message/tool translation and the event stream.

The OpenAI client and MCP client are mocked so tests run offline and fast.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.agent import (
    CtxSpaceAgent,
    _ag_messages_to_openai,
    _frontend_tools_to_openai,
)
from app.config import Settings


def _settings() -> Settings:
    return Settings(  # type: ignore[call-arg]
        OPENAI_API_KEY="sk-test",
        OPENAI_MODEL="gpt-5-mini",
        MCP_SERVER_URL="https://example.test/mcp",
        MCP_SERVER_LABEL="mps",
    )


# --- pure translation helpers -------------------------------------------------


def test_ag_messages_to_openai_maps_roles() -> None:
    messages = [
        SimpleNamespace(role="user", content="hi"),
        SimpleNamespace(role="developer", content="be nice"),
        SimpleNamespace(role="tool", content="result", tool_call_id="t1"),
    ]
    out = _ag_messages_to_openai(messages)
    assert out[0] == {"role": "user", "content": "hi"}
    assert out[1]["role"] == "system"  # developer -> system
    assert out[2] == {"role": "tool", "tool_call_id": "t1", "content": "result"}


def test_multimodal_image_content_converted() -> None:
    from app.agent import _convert_content

    text = SimpleNamespace(type="text", text="match this UI")
    image = SimpleNamespace(
        type="image",
        source=SimpleNamespace(type="data", value="QUJD", mime_type="image/png"),
    )
    out = _convert_content([text, image])
    assert isinstance(out, list)
    assert out[0] == {"type": "text", "text": "match this UI"}
    assert out[1]["type"] == "image_url"
    assert out[1]["image_url"]["url"] == "data:image/png;base64,QUJD"


def test_url_image_source_passthrough() -> None:
    from app.agent import _convert_content

    image = SimpleNamespace(
        type="image",
        source=SimpleNamespace(type="url", value="https://x.test/a.png", mime_type="image/png"),
    )
    out = _convert_content([image])
    assert out[0]["image_url"]["url"] == "https://x.test/a.png"


def test_frontend_tools_to_openai() -> None:
    tools = [
        SimpleNamespace(
            name="writeFile",
            description="write a file",
            parameters={"type": "object", "properties": {}},
        )
    ]
    out = _frontend_tools_to_openai(tools)
    assert out[0]["type"] == "function"
    assert out[0]["function"]["name"] == "writeFile"


# --- streaming behaviour (mocked OpenAI) -------------------------------------


class _FakeStream:
    """Async-iterable yielding fake chat-completion chunks."""

    def __init__(self, chunks: list[object]) -> None:
        self._chunks = chunks

    def __aiter__(self):
        async def gen():
            for c in self._chunks:
                yield c

        return gen()


def _text_chunk(text: str) -> object:
    delta = SimpleNamespace(content=text, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta)])


def _tool_chunk(index: int, tc_id: str, name: str, args: str) -> object:
    fn = SimpleNamespace(name=name, arguments=args)
    tc = SimpleNamespace(index=index, id=tc_id, function=fn)
    delta = SimpleNamespace(content=None, tool_calls=[tc])
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta)])


@pytest.fixture
def agent(monkeypatch: pytest.MonkeyPatch) -> CtxSpaceAgent:
    a = CtxSpaceAgent(_settings())

    async def _no_mcp() -> list:
        return []

    monkeypatch.setattr(a, "_load_mcp_tools", _no_mcp)
    return a


def _make_input(message: str):
    from ag_ui.core import RunAgentInput

    return RunAgentInput(
        thread_id="th1",
        run_id="r1",
        state={},
        messages=[{"id": "m1", "role": "user", "content": message}],
        tools=[
            {
                "name": "writeFile",
                "description": "write a file",
                "parameters": {"type": "object", "properties": {}},
            }
        ],
        context=[],
        forwarded_props={},
    )


async def test_run_emits_text_events(agent: CtxSpaceAgent, monkeypatch) -> None:
    async def fake_create(**_kwargs):
        return _FakeStream([_text_chunk("Hello"), _text_chunk(" world")])

    monkeypatch.setattr(agent._client.chat.completions, "create", fake_create)

    events = [e async for e in agent.run(_make_input("hi"), accept=None)]
    blob = "".join(events)
    assert "RUN_STARTED" in blob
    assert "TEXT_MESSAGE_START" in blob
    assert "TEXT_MESSAGE_CONTENT" in blob
    assert "RUN_FINISHED" in blob


async def test_run_emits_frontend_tool_call(agent: CtxSpaceAgent, monkeypatch) -> None:
    args = json.dumps({"path": "src/App.tsx", "contents": "x"})

    async def fake_create(**_kwargs):
        return _FakeStream([_tool_chunk(0, "call_1", "writeFile", args)])

    monkeypatch.setattr(agent._client.chat.completions, "create", fake_create)

    events = [e async for e in agent.run(_make_input("build a todo app"), accept=None)]
    blob = "".join(events)
    assert "TOOL_CALL_START" in blob
    assert "TOOL_CALL_ARGS" in blob
    assert "TOOL_CALL_END" in blob
    assert "writeFile" in blob
