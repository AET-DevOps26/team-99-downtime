"""Startup probe integration: lifespan must call probe() and fail fast."""

import pytest
from fastapi.testclient import TestClient

from src import config
from src import llm as llm_module
from src.main import app


def test_startup_fails_when_probe_raises(monkeypatch):
    monkeypatch.setattr(config, "LLM_SKIP_STARTUP_CHECK", False)

    async def _failing_probe():
        raise llm_module.LlmUnavailableError("key rejected")

    monkeypatch.setattr(llm_module, "probe", _failing_probe)
    with pytest.raises(llm_module.LlmUnavailableError), TestClient(app):
        pass


def test_startup_succeeds_when_probe_passes(monkeypatch):
    monkeypatch.setattr(config, "LLM_SKIP_STARTUP_CHECK", False)

    async def _ok_probe():
        pass

    monkeypatch.setattr(llm_module, "probe", _ok_probe)
    with TestClient(app):
        pass  # no exception = startup succeeded


def test_startup_skips_probe_when_flag_set(monkeypatch):
    # The autouse fixture in conftest.py has already set LLM_SKIP_STARTUP_CHECK=True.
    # We confirm probe is never invoked.
    probe_called = {"called": False}

    async def _probe_spy():
        probe_called["called"] = True

    monkeypatch.setattr(llm_module, "probe", _probe_spy)
    with TestClient(app):
        pass
    assert not probe_called["called"]
