"""Extraction tests for /categorize.

The LLM round-trip is stubbed via the shared ``llm`` fixture (conftest.py), so
these exercise the real prompt building, JSON parsing, validation and error
mapping — offline, like the auth tests.
"""

import json

import pytest
from fastapi.testclient import TestClient

from src.auth import CurrentUser, require_user
from src.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _authenticated():
    app.dependency_overrides[require_user] = lambda: CurrentUser(
        "user-123", "user@team99.dev"
    )
    yield
    app.dependency_overrides.clear()


def _post(text="lunch at mensa 8.50", categories=("Dining", "Groceries")):
    return client.post(
        "/api/genai/categorize", json={"text": text, "categories": list(categories)}
    )


def _expense(**overrides):
    return {
        "amount": 8.5,
        "currency": "EUR",
        "merchant": "Mensa",
        "category": "Dining",
        "date": "2026-07-01",
        **overrides,
    }


def test_extracts_single_expense(llm):
    llm["reply"] = json.dumps({"expenses": [_expense()]})
    res = _post()
    assert res.status_code == 200
    assert res.json() == {"expenses": [_expense()]}


def test_extracts_multiple_expenses(llm):
    llm["reply"] = json.dumps(
        {
            "expenses": [
                _expense(),
                _expense(amount=42.0, merchant="Rewe", category="Groceries"),
            ]
        }
    )
    res = _post("lunch 8.50 at mensa and 42 at rewe")
    assert res.status_code == 200
    assert [e["merchant"] for e in res.json()["expenses"]] == ["Mensa", "Rewe"]


def test_prompt_carries_categories_and_sentence(llm):
    llm["reply"] = json.dumps({"expenses": [_expense()]})
    _post(text="coffee 3", categories=("Dining", "Travel"))
    system, user = llm["messages"]
    assert "Dining, Travel" in system["content"]
    assert user == {"role": "user", "content": "coffee 3"}


def test_vague_sentence_is_422(llm):
    llm["reply"] = json.dumps({"too_vague": True})
    res = _post("spent 50 on stuff")
    assert res.status_code == 422
    assert res.json()["detail"] == "TOO_VAGUE"


def test_empty_expense_list_is_422(llm):
    llm["reply"] = json.dumps({"expenses": []})
    assert _post().status_code == 422


def test_tolerates_fenced_json(llm):
    llm["reply"] = f"```json\n{json.dumps({'expenses': [_expense()]})}\n```"
    assert _post().status_code == 200


def test_garbage_reply_is_502(llm):
    llm["reply"] = "I could not process that."
    res = _post()
    assert res.status_code == 502
    assert res.json()["detail"] == "LLM_UNAVAILABLE"


def test_invalid_amount_is_502(llm):
    llm["reply"] = json.dumps({"expenses": [_expense(amount=-3)]})
    assert _post().status_code == 502
