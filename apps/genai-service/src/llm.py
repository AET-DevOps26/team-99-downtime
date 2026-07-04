"""The Logos LLM gateway client (OpenAI-compatible chat completions).

Every feature module (categorize, summarize) funnels its model calls through
``chat`` so the gateway config lives in one place and tests can stub a single
seam (see the ``llm`` fixture in tests/conftest.py).
"""

import httpx

from . import config


class LlmUnavailableError(Exception):
    """The LLM gateway was unreachable or returned something unusable."""


async def chat(messages: list[dict]) -> str:
    """One chat-completions round-trip; returns the assistant message text."""
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
