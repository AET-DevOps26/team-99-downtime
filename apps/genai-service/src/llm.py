"""The Logos LLM gateway client (OpenAI-compatible chat completions).

Every feature module (categorize, summarize) funnels its model calls through
``chat`` so the gateway config lives in one place and tests can stub a single
seam (see the ``llm`` fixture in tests/conftest.py).
"""

import logging

import httpx

from . import config

logger = logging.getLogger(__name__)


class LlmUnavailableError(Exception):
    """The LLM gateway was unreachable or returned something unusable."""


async def chat(messages: list[dict]) -> str:
    """One chat-completions round-trip; returns the assistant message text.

    Any failure of the round-trip itself — network trouble, an error status,
    or a response body without the expected shape — raises
    LlmUnavailableError, so every caller maps to its 502 contract for free.
    """
    try:
        async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{config.LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {config.LLM_API_KEY}"},
                json={
                    "model": config.LLM_MODEL,
                    "messages": messages,
                    "temperature": 0,
                },
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
        raise LlmUnavailableError(str(exc)) from exc


async def probe() -> None:
    """Verify the LLM gateway accepts the configured API key.

    Raises LlmUnavailableError only for definitive configuration errors: an
    empty key, or a 401/403 from the gateway. A gateway that is merely
    unreachable (timeout, connection error) logs a warning and lets the
    service start — the endpoints already degrade to 502 LLM_UNAVAILABLE,
    whereas exiting here crash-loops the pod for the whole outage and blocks
    `helm --wait` rollouts of every service.
    """
    if not config.LLM_API_KEY:
        raise LlmUnavailableError("LLM_API_KEY is not set")
    try:
        async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{config.LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {config.LLM_API_KEY}"},
                json={
                    "model": config.LLM_MODEL,
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 1,
                },
            )
    except httpx.HTTPError as exc:
        logger.warning(
            "LLM gateway unreachable during startup key check, starting anyway: %s",
            exc,
        )
        return
    if response.status_code in (401, 403):
        raise LlmUnavailableError(
            f"LLM gateway rejected the API key (HTTP {response.status_code})"
        )
