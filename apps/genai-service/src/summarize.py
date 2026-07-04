"""Weekly spending summary generation (US-11, issue #24).

The caller supplies the numbers — this week's transactions plus last week's
totals — because the data owner differs per path: the dashboard's manual
trigger holds the user's JWT and fetches the report from transaction-service,
while the weekly scheduler runs inside transaction-service (which reads its own
database) and posts to the internal route where no user token exists. Either
way the model only turns the given numbers into a few plain-language sentences;
it never fetches data itself.
"""

import datetime
import json

from pydantic import BaseModel, ConfigDict, Field

from . import llm

# Fewer transactions than this in a week would produce a "summary" that is
# noise, so nothing is generated or stored (issue #24: an insufficient-data
# week must not yield a misleading summary).
MIN_TRANSACTIONS = 3


class SummaryTransaction(BaseModel):
    """One expense of the week being summarized, as sent by the caller."""

    date: datetime.date
    amount: float = Field(gt=0)
    currency: str = "EUR"
    description: str


class LastWeekTotals(BaseModel):
    """Aggregate of the previous week, for the week-over-week comparison."""

    total: float = Field(ge=0)
    count: int = Field(ge=0)


class WeeklyData(BaseModel):
    """The summarize request payload: one week of expenses plus context."""

    model_config = ConfigDict(populate_by_name=True)

    week_start: datetime.date = Field(alias="weekStart")
    this_week: list[SummaryTransaction] = Field(alias="thisWeek")
    last_week: LastWeekTotals = Field(alias="lastWeek")


class NotEnoughDataError(Exception):
    """Too few transactions this week for an honest summary."""


_SYSTEM_PROMPT = """\
You write the short weekly spending summary shown on a personal-finance
dashboard. You get one week of a user's expenses as JSON: the week starting
week_start (possibly still in progress) under this_week, and the previous
week's total and expense count under last_week.

Write 2-3 plain sentences, at most 60 words, that a non-expert immediately
understands. Reply with the sentences only — no preamble, no quotes.

Rules:
- Plain prose: no markdown, no bullet points, no emojis, no headings.
- Reference concrete numbers: this week's total, the biggest expense or a
  merchant/theme that dominated, and the change versus last week.
- Compare to last week (as a percentage or amount) only when last_week.count
  is greater than zero; otherwise mention this is the first tracked week.
- Use the currency of the data (EUR amounts read like 42.50 EUR).
- Never invent numbers that are not derivable from the data.
- Describe, don't judge: no financial advice, no scolding, friendly tone.
"""


def build_messages(data: WeeklyData) -> list[dict]:
    """The exact chat messages for a payload — deterministic, tested as such."""
    payload = {
        "week_start": data.week_start.isoformat(),
        "this_week": [
            {
                "date": t.date.isoformat(),
                "amount": t.amount,
                "currency": t.currency,
                "description": t.description,
            }
            for t in data.this_week
        ],
        "last_week": {"total": data.last_week.total, "count": data.last_week.count},
    }
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload)},
    ]


async def summarize(data: WeeklyData) -> str:
    """Turn one week of expense data into a short plain-language summary."""
    if len(data.this_week) < MIN_TRANSACTIONS:
        raise NotEnoughDataError
    reply = (await llm.chat(build_messages(data))).strip()
    if not reply:
        raise llm.LlmUnavailableError("model returned an empty summary")
    return reply
