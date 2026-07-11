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


class _UnauthorizedClient(_FailingClient):
    async def post(self, *args, **kwargs):
        request = httpx.Request("POST", "http://logos.test/v1/chat/completions")
        return httpx.Response(401, json={"error": "Unauthorized"}, request=request)


class _ForbiddenClient(_FailingClient):
    async def post(self, *args, **kwargs):
        request = httpx.Request("POST", "http://logos.test/v1/chat/completions")
        return httpx.Response(403, json={"error": "Forbidden"}, request=request)


class _OkProbeClient(_FailingClient):
    async def post(self, *args, **kwargs):
        request = httpx.Request("POST", "http://logos.test/v1/chat/completions")
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "ok"}}]}, request=request
        )


def test_probe_raises_when_key_is_empty(monkeypatch):
    monkeypatch.setattr(llm.config, "LLM_API_KEY", "")
    with pytest.raises(llm.LlmUnavailableError, match="LLM_API_KEY is not set"):
        asyncio.run(llm.probe())


def test_probe_raises_on_401(monkeypatch):
    monkeypatch.setattr(llm.config, "LLM_API_KEY", "some-key")
    monkeypatch.setattr(llm.httpx, "AsyncClient", _UnauthorizedClient)
    with pytest.raises(llm.LlmUnavailableError, match="401"):
        asyncio.run(llm.probe())


def test_probe_raises_on_403(monkeypatch):
    monkeypatch.setattr(llm.config, "LLM_API_KEY", "some-key")
    monkeypatch.setattr(llm.httpx, "AsyncClient", _ForbiddenClient)
    with pytest.raises(llm.LlmUnavailableError, match="403"):
        asyncio.run(llm.probe())


def test_probe_raises_on_network_failure(monkeypatch):
    monkeypatch.setattr(llm.config, "LLM_API_KEY", "some-key")
    monkeypatch.setattr(llm.httpx, "AsyncClient", _FailingClient)
    with pytest.raises(llm.LlmUnavailableError):
        asyncio.run(llm.probe())


def test_probe_passes_on_200(monkeypatch):
    monkeypatch.setattr(llm.config, "LLM_API_KEY", "some-key")
    monkeypatch.setattr(llm.httpx, "AsyncClient", _OkProbeClient)
    asyncio.run(llm.probe())  # must not raise
