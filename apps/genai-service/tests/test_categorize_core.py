"""Unit tests for the genai-service extraction core."""

import asyncio
import json

import httpx
import pytest

from src import llm as llm_module
from src.categorize import (
    LlmUnavailableError,
    TooVagueError,
    UnreadableFileError,
    _extract_json,
    categorize,
    parse_file,
)


def _run(coro):
    return asyncio.run(coro)


def _expense(**overrides):
    return {
        "amount": 8.5,
        "merchant": "Mensa",
        "category": "Dining",
        "date": "2026-07-01",
        **overrides,
    }


def _row(row=2, **overrides):
    return {
        "row": row,
        "amount": 12.3,
        "currency": "EUR",
        "merchant": "Rewe Markt",
        "category": "Groceries",
        "date": "2026-07-01",
        **overrides,
    }


def test_extract_json_tolerates_fences_and_surrounding_text():
    payload = _extract_json('before ```json\n{"expenses": []}\n``` after')

    assert payload == {"expenses": []}


def test_extract_json_rejects_replies_without_json():
    with pytest.raises(ValueError, match="no JSON object"):
        _extract_json("I cannot extract anything useful.")


def test_categorize_returns_validated_expenses_and_defaults_currency(llm):
    llm["reply"] = json.dumps({"expenses": [_expense()]})

    expenses = _run(categorize("lunch at mensa 8.50", ["Dining", "Groceries"]))

    assert len(expenses) == 1
    assert expenses[0].amount == 8.5
    assert expenses[0].currency == "EUR"
    assert expenses[0].merchant == "Mensa"
    assert llm["messages"][1] == {"role": "user", "content": "lunch at mensa 8.50"}
    assert "Dining, Groceries" in llm["messages"][0]["content"]


@pytest.mark.parametrize("reply", [{"too_vague": True}, {"expenses": []}])
def test_categorize_maps_unusable_model_result_to_too_vague(llm, reply):
    llm["reply"] = json.dumps(reply)

    with pytest.raises(TooVagueError):
        _run(categorize("spent 50 on stuff", ["Dining"]))


def test_categorize_maps_invalid_expense_to_llm_unavailable(llm):
    llm["reply"] = json.dumps({"expenses": [_expense(amount=-3)]})

    with pytest.raises(LlmUnavailableError, match="invalid expense"):
        _run(categorize("refund-like bad model output", ["Dining"]))


def test_parse_file_returns_validated_expenses_and_skipped_rows(llm):
    llm["reply"] = json.dumps(
        {
            "expenses": [_row()],
            "skipped": [{"row": 3, "reason": "incoming payment"}],
        }
    )
    content = "Date,Description,Amount\n2026-07-01,REWE,-12.30\n"

    expenses, skipped = _run(parse_file(content, ["Groceries", "Dining"]))

    assert expenses[0].row == 2
    assert expenses[0].amount == 12.3
    assert skipped[0].reason == "incoming payment"
    assert llm["messages"][1] == {"role": "user", "content": content}
    assert "Groceries, Dining" in llm["messages"][0]["content"]


@pytest.mark.parametrize(
    "reply",
    [
        {"unreadable": True},
        {"expenses": [], "skipped": []},
    ],
)
def test_parse_file_maps_unreadable_or_empty_result_to_domain_error(llm, reply):
    llm["reply"] = json.dumps(reply)

    with pytest.raises(UnreadableFileError):
        _run(parse_file("not an expense file", ["Groceries"]))


def test_parse_file_all_skipped_rows_are_still_a_valid_result(llm):
    llm["reply"] = json.dumps(
        {"expenses": [], "skipped": [{"row": 2, "reason": "no amount"}]}
    )

    expenses, skipped = _run(parse_file("Date,Amount\ngarbage", ["Groceries"]))

    assert expenses == []
    assert skipped[0].row == 2
    assert skipped[0].reason == "no amount"


def test_parse_file_maps_invalid_rows_to_llm_unavailable(llm):
    llm["reply"] = json.dumps({"expenses": [_row(row=0)], "skipped": []})

    with pytest.raises(LlmUnavailableError, match="invalid row"):
        _run(parse_file("Date,Description,Amount\nbad,row,-1", ["Groceries"]))


def test_transport_errors_are_wrapped_as_llm_unavailable(monkeypatch):
    # The wrapping moved into the shared llm seam (src/llm.py) alongside the
    # weekly-summary work; patch the module attribute categorize calls through.
    async def fake_chat(messages):
        raise httpx.ConnectError("gateway down")

    monkeypatch.setattr(llm_module, "chat", fake_chat)

    with pytest.raises(LlmUnavailableError, match="gateway down"):
        _run(categorize("coffee 3", ["Dining"]))
