"""Unit tests configuration module."""

import pytest

from src import categorize as categorize_module


@pytest.fixture
def llm(monkeypatch):
    """Stub the LLM chat call: set ``llm["reply"]``, read back ``llm["messages"]``."""
    state = {"reply": "", "messages": None}

    async def fake_chat(messages):
        state["messages"] = messages
        return state["reply"]

    monkeypatch.setattr(categorize_module, "_chat", fake_chat)
    return state
