"""Parsing tests for /parse-csv.

The LLM round-trip is stubbed via the shared ``llm`` fixture (conftest.py);
the two bank-format cases pin down that the raw CSV reaches the model verbatim
and that per-row results (imported vs skipped) flow through unchanged.
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


@pytest.fixture(autouse=True)
def _authenticated():
    app.dependency_overrides[require_user] = lambda: CurrentUser(
        "user-123", "user@team99.dev"
    )
    yield
    app.dependency_overrides.clear()


def _post(csv, categories=("Groceries", "Dining")):
    return client.post(
        "/api/genai/parse-csv", json={"csv": csv, "categories": list(categories)}
    )


def _reply(expenses=(), skipped=()):
    return json.dumps({"expenses": list(expenses), "skipped": list(skipped)})


def test_german_bank_format(llm):
    llm["reply"] = _reply(
        expenses=[
            {
                "row": 2,
                "amount": 12.30,
                "currency": "EUR",
                "merchant": "Rewe Markt",
                "category": "Groceries",
                "date": "2026-07-01",
            }
        ],
        skipped=[{"row": 3, "reason": "incoming payment, not an expense"}],
    )
    res = _post(DKB_CSV)
    assert res.status_code == 200
    body = res.json()
    assert body["expenses"][0]["amount"] == 12.30
    assert body["expenses"][0]["row"] == 2
    assert body["skipped"] == [{"row": 3, "reason": "incoming payment, not an expense"}]
    # The raw CSV must reach the model verbatim as the user message.
    assert llm["messages"][1] == {"role": "user", "content": DKB_CSV}
    assert "Groceries, Dining" in llm["messages"][0]["content"]


def test_us_bank_format(llm):
    llm["reply"] = _reply(
        expenses=[
            {
                "row": 2,
                "amount": 4.50,
                "currency": "USD",
                "merchant": "Starbucks",
                "category": "Dining",
                "date": "2026-07-01",
            }
        ],
        skipped=[{"row": 3, "reason": "credit"}],
    )
    res = _post(CHASE_CSV)
    assert res.status_code == 200
    assert res.json()["expenses"][0]["currency"] == "USD"
    assert llm["messages"][1]["content"] == CHASE_CSV


def test_all_rows_skipped_is_still_a_result(llm):
    llm["reply"] = _reply(skipped=[{"row": 2, "reason": "no amount"}])
    res = _post("Datum;Betrag\ngarbage;;")
    assert res.status_code == 200
    assert res.json() == {
        "expenses": [],
        "skipped": [{"row": 2, "reason": "no amount"}],
    }


def test_non_csv_content_is_422(llm):
    llm["reply"] = json.dumps({"not_csv": True})
    res = _post("this is just prose, not a table")
    assert res.status_code == 422
    assert res.json()["detail"] == "NOT_CSV"


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
