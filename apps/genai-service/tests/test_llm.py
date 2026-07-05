"""The shared LLM seam: gateway failures must surface as LlmUnavailableError.

Regression for the 502 contract — a transport error or an unexpected response
shape escaping ``chat`` as a raw exception would reach the client as a 500
instead of the documented 502 LLM_UNAVAILABLE.
"""

import asyncio

import httpx
import pytest

from src import llm


class _FailingClient:
    """httpx.AsyncClient stand-in whose POST never reaches a gateway."""

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, *args, **kwargs):
        raise httpx.ConnectError("gateway unreachable")


class _MalformedReplyClient(_FailingClient):
    """Answers 200 but without the chat-completions shape."""

    async def post(self, *args, **kwargs):
        request = httpx.Request("POST", "http://logos.test/v1/chat/completions")
        return httpx.Response(200, json={"unexpected": "shape"}, request=request)


def test_network_failure_raises_llm_unavailable(monkeypatch):
    monkeypatch.setattr(llm.httpx, "AsyncClient", _FailingClient)
    with pytest.raises(llm.LlmUnavailableError):
        asyncio.run(llm.chat([{"role": "user", "content": "hi"}]))


def test_malformed_reply_raises_llm_unavailable(monkeypatch):
    monkeypatch.setattr(llm.httpx, "AsyncClient", _MalformedReplyClient)
    with pytest.raises(llm.LlmUnavailableError):
        asyncio.run(llm.chat([{"role": "user", "content": "hi"}]))
