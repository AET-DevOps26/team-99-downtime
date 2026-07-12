"""Unit tests configuration module."""

import pytest

from src import llm as llm_module


@pytest.fixture(autouse=True)
def _skip_llm_probe(monkeypatch):
    """Bypass the LLM startup probe in all unit tests."""
    monkeypatch.setattr("src.config.LLM_SKIP_STARTUP_CHECK", True)


@pytest.fixture(autouse=True)
def _no_summary_store(monkeypatch):
    """Never connect to a real database: a DATABASE_URL leaking in from the
    environment (Nx injects the repo-root .env) would make lifespan tests
    dial out to Postgres."""
    monkeypatch.setattr("src.config.DATABASE_URL", "")


@pytest.fixture
def llm(monkeypatch):
    """Stub the LLM chat call: set ``llm["reply"]``, read back ``llm["messages"]``."""
    state = {"reply": "", "messages": None}

    async def fake_chat(messages):
        state["messages"] = messages
        return state["reply"]

    monkeypatch.setattr(llm_module, "chat", fake_chat)
    return state
