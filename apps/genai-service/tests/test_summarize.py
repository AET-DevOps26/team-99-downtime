"""Weekly-summary tests for /summarize, /summarize/latest and the internal route.

The LLM round-trip is stubbed via the shared ``llm`` fixture (conftest.py) and
persistence via an in-memory store, so these exercise the real prompt building,
the not-enough-data rule, the upsert semantics and the error mapping — offline.
"""

import datetime
import json

import pytest
from fastapi.testclient import TestClient

from src import summarize as summarize_module
from src.auth import CurrentUser, require_user
from src.main import app, get_summary_store
from src.store import StoredSummary

client = TestClient(app)

GENERATED_AT = datetime.datetime(2026, 7, 2, 18, 0, tzinfo=datetime.timezone.utc)


class FakeStore:
    """In-memory stand-in for SummaryStore with the same upsert semantics."""

    def __init__(self):
        self.rows = {}

    async def upsert(self, user_id, week_start, summary):
        stored = StoredSummary(
            summary=summary, week_start=week_start, generated_at=GENERATED_AT
        )
        self.rows[(user_id, week_start)] = stored
        return stored

    async def latest(self, user_id):
        mine = [s for (uid, _), s in self.rows.items() if uid == user_id]
        return max(mine, key=lambda s: s.week_start, default=None)


@pytest.fixture
def store():
    fake = FakeStore()
    app.dependency_overrides[get_summary_store] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_summary_store, None)


@pytest.fixture(autouse=True)
def _authenticated():
    app.dependency_overrides[require_user] = lambda: CurrentUser(
        "user-123", "user@team99.dev"
    )
    yield
    app.dependency_overrides.clear()


def _tx(date, amount, desc):
    return {"date": date, "amount": amount, "currency": "EUR", "description": desc}


THIS_WEEK = [
    _tx("2026-06-29", 12.5, "Rewe"),
    _tx("2026-06-30", 8.0, "Mensa"),
    _tx("2026-07-04", 30.0, "DB Ticket"),
]


def _payload(count=3):
    return {
        "weekStart": "2026-06-29",
        "thisWeek": THIS_WEEK[:count],
        "lastWeek": {"total": 41.2, "count": 4},
    }


def test_generates_stores_and_returns_summary(llm, store):
    llm["reply"] = "You spent 50.50 EUR across 3 expenses, up 23% from last week."
    res = client.post("/api/genai/summarize", json=_payload())
    assert res.status_code == 200
    body = res.json()
    assert body["summary"] == llm["reply"]
    assert body["weekStart"] == "2026-06-29"
    assert body["generatedAt"]
    assert store.rows[("user-123", datetime.date(2026, 6, 29))].summary == llm["reply"]


def test_regenerating_a_week_overwrites_not_duplicates(llm, store):
    llm["reply"] = "First version."
    client.post("/api/genai/summarize", json=_payload())
    llm["reply"] = "Second version."
    res = client.post("/api/genai/summarize", json=_payload())
    assert res.status_code == 200
    assert len(store.rows) == 1
    stored = store.rows[("user-123", datetime.date(2026, 6, 29))]
    assert stored.summary == "Second version."


def test_too_few_transactions_is_422_and_stores_nothing(llm, store):
    too_few = _payload(count=summarize_module.MIN_TRANSACTIONS - 1)
    res = client.post("/api/genai/summarize", json=too_few)
    assert res.status_code == 422
    assert res.json()["detail"] == "NOT_ENOUGH_DATA"
    assert store.rows == {}
    assert llm["messages"] is None  # the LLM was never called


def test_empty_model_reply_is_502(llm, store):
    llm["reply"] = "   "
    res = client.post("/api/genai/summarize", json=_payload())
    assert res.status_code == 502
    assert res.json()["detail"] == "LLM_UNAVAILABLE"
    assert store.rows == {}


def test_latest_is_404_before_first_summary(store):
    res = client.get("/api/genai/summarize/latest")
    assert res.status_code == 404
    assert res.json()["detail"] == "NO_SUMMARY"


def test_latest_returns_most_recent_week(llm, store):
    llm["reply"] = "Older week."
    older = _payload()
    older["weekStart"] = "2026-06-22"
    client.post("/api/genai/summarize", json=older)
    llm["reply"] = "Newer week."
    client.post("/api/genai/summarize", json=_payload())

    res = client.get("/api/genai/summarize/latest")
    assert res.status_code == 200
    assert res.json()["summary"] == "Newer week."
    assert res.json()["weekStart"] == "2026-06-29"


def test_internal_route_stores_for_the_given_user(llm, store):
    # No auth override needed: the internal route trusts the network boundary.
    app.dependency_overrides.pop(require_user, None)
    llm["reply"] = "Cron-generated summary."
    res = client.post("/internal/summarize", json={"userId": "cron-user", **_payload()})
    assert res.status_code == 200
    assert store.rows[("cron-user", datetime.date(2026, 6, 29))].summary == llm["reply"]


def test_summarize_requires_auth(store):
    app.dependency_overrides.pop(require_user, None)
    assert client.post("/api/genai/summarize", json=_payload()).status_code == 401
    assert client.get("/api/genai/summarize/latest").status_code == 401


def test_no_database_configured_is_503(llm):
    # Without the store override (and no lifespan run) there is no store.
    res = client.post("/api/genai/summarize", json=_payload())
    assert res.status_code == 503
    assert res.json()["detail"] == "SUMMARY_STORE_UNAVAILABLE"


def test_prompt_is_deterministic(llm, store):
    llm["reply"] = "Anything."
    client.post("/api/genai/summarize", json=_payload())

    system, user = llm["messages"]
    assert system == {"role": "system", "content": summarize_module._SYSTEM_PROMPT}
    # The user message is the payload re-serialized in a fixed field order —
    # byte-identical across runs, so cached LLM answers stay deterministic.
    assert user == {
        "role": "user",
        "content": json.dumps(
            {
                "week_start": "2026-06-29",
                "this_week": THIS_WEEK,
                "last_week": {"total": 41.2, "count": 4},
            }
        ),
    }
