"""Parsing tests for /parse-file.

The LLM round-trip is stubbed via the shared ``llm`` fixture (conftest.py).
The cases pin down that the raw file content reaches the model verbatim and
that per-row results (imported vs skipped) flow through unchanged — for two
different bank CSV formats and for free-text notes with mixed lines.
"""

import json

import pytest
from fastapi.testclient import TestClient

from src.auth import CurrentUser, require_user
from src.main import app

client = TestClient(app)

# Two deliberately different bank exports: German semicolon/comma-decimal
# format and a US-style comma/dot-decimal format.
DKB_CSV = """\
Buchungstag;Auftraggeber;Betrag;Waehrung
01.07.2026;REWE MARKT GMBH;-12,30;EUR
01.07.2026;GEHALT JULI;+2.500,00;EUR
"""

CHASE_CSV = """\
Date,Description,Amount
2026-07-01,STARBUCKS COFFEE,-4.50
2026-07-02,PAYCHECK,3000.00
"""

NOTES_TXT = """\
lunch at mensa 8.50
bought some stuff
coffee 3 euro yesterday
"""


@pytest.fixture(autouse=True)
def _authenticated():
    app.dependency_overrides[require_user] = lambda: CurrentUser(
        "user-123", "user@team99.dev"
    )
    yield
    app.dependency_overrides.clear()


def _post(content, categories=("Groceries", "Dining")):
    return client.post(
        "/api/genai/parse-file",
        json={"content": content, "categories": list(categories)},
    )


def _reply(expenses=(), skipped=()):
    return json.dumps({"expenses": list(expenses), "skipped": list(skipped)})


def _expense(row, **overrides):
    return {
        "row": row,
        "amount": 12.30,
        "currency": "EUR",
        "merchant": "Rewe Markt",
        "category": "Groceries",
        "date": "2026-07-01",
        **overrides,
    }


def test_german_bank_format(llm):
    llm["reply"] = _reply(
        expenses=[_expense(2)],
        skipped=[{"row": 3, "reason": "incoming payment, not an expense"}],
    )
    res = _post(DKB_CSV)
    assert res.status_code == 200
    body = res.json()
    assert body["expenses"][0]["amount"] == 12.30
    assert body["expenses"][0]["row"] == 2
    assert body["skipped"] == [{"row": 3, "reason": "incoming payment, not an expense"}]
    # The raw file content must reach the model verbatim as the user message.
    assert llm["messages"][1] == {"role": "user", "content": DKB_CSV}
    assert "Groceries, Dining" in llm["messages"][0]["content"]


def test_us_bank_format(llm):
    llm["reply"] = _reply(
        expenses=[_expense(2, amount=4.50, currency="USD", merchant="Starbucks")],
        skipped=[{"row": 3, "reason": "credit"}],
    )
    res = _post(CHASE_CSV)
    assert res.status_code == 200
    assert res.json()["expenses"][0]["currency"] == "USD"
    assert llm["messages"][1]["content"] == CHASE_CSV


def test_free_text_notes_with_mixed_lines(llm):
    llm["reply"] = _reply(
        expenses=[
            _expense(1, amount=8.50, merchant="Mensa", category="Dining"),
            _expense(3, amount=3.00, merchant="Coffee", category="Dining"),
        ],
        skipped=[{"row": 2, "reason": "too vague"}],
    )
    res = _post(NOTES_TXT)
    assert res.status_code == 200
    body = res.json()
    assert [e["row"] for e in body["expenses"]] == [1, 3]
    assert body["skipped"] == [{"row": 2, "reason": "too vague"}]
    assert llm["messages"][1]["content"] == NOTES_TXT


def test_all_rows_skipped_is_still_a_result(llm):
    llm["reply"] = _reply(skipped=[{"row": 2, "reason": "no amount"}])
    res = _post("Datum;Betrag\ngarbage;;")
    assert res.status_code == 200
    assert res.json() == {
        "expenses": [],
        "skipped": [{"row": 2, "reason": "no amount"}],
    }


def test_unreadable_content_is_422(llm):
    llm["reply"] = json.dumps({"unreadable": True})
    res = _post("chapter one: it was a dark and stormy night")
    assert res.status_code == 422
    assert res.json()["detail"] == "UNREADABLE_FILE"


def test_empty_model_result_is_422(llm):
    llm["reply"] = _reply()
    assert _post(DKB_CSV).status_code == 422


def test_garbage_reply_is_502(llm):
    llm["reply"] = "cannot help with that"
    res = _post(DKB_CSV)
    assert res.status_code == 502
    assert res.json()["detail"] == "LLM_UNAVAILABLE"


def test_invalid_row_shape_is_502(llm):
    llm["reply"] = _reply(expenses=[{"row": 0, "amount": -1}])
    assert _post(DKB_CSV).status_code == 502
