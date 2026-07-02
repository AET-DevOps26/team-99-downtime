"""Expense extraction via the Logos LLM gateway: free-text sentences and bank CSVs.

The model gets the user's input plus their existing category names and must
answer with strict JSON. A deliberate model refusal (too vague / not a CSV)
surfaces as a dedicated error for the API's preset 422; network trouble or a
malformed reply surfaces as LlmUnavailableError (502).
"""

import datetime
import json

import httpx
from pydantic import BaseModel, Field, ValidationError

from . import config


class ParsedExpense(BaseModel):
    """One expense extracted from the sentence."""

    amount: float = Field(gt=0)
    currency: str = "EUR"
    merchant: str
    category: str
    date: datetime.date


class RowExpense(ParsedExpense):
    """One expense extracted from a row/line of an uploaded file."""

    row: int = Field(ge=1)


class SkippedRow(BaseModel):
    """A row/line that could not be imported, with the reason why."""

    row: int = Field(ge=1)
    reason: str


class TooVagueError(Exception):
    """The sentence lacks the detail needed to extract an expense."""


class UnreadableFileError(Exception):
    """Nothing in the uploaded content looks like expense data."""


class LlmUnavailableError(Exception):
    """The LLM gateway was unreachable or returned something unusable."""


_SYSTEM_PROMPT = """\
You extract structured expense records from a user's free-text sentence.

Today is {today}. Resolve relative dates ("yesterday", "last friday") against
it; when no date is mentioned, use today.

The user's spending categories are: {categories}.
Pick the best-fitting one for each expense. You MUST copy one of the listed
names verbatim — never invent a new category.

Reply with ONLY a JSON object, no prose, in one of these two shapes:
  {{"expenses": [{{"amount": 12.5, "currency": "EUR", "merchant": "Rewe",
                   "category": "<a listed name>", "date": "2026-07-02"}}]}}
  {{"too_vague": true}}

Rules:
- One entry per expense; a single sentence may contain several.
- amount is a positive number. Default currency is EUR.
- merchant is where or on what the money was spent, short and title-cased.
- If the sentence lacks a clear amount or a clear thing/place the money went
  to (e.g. "spent 50 on stuff"), reply {{"too_vague": true}}.
"""


_FILE_SYSTEM_PROMPT = """\
You extract expense records from an uploaded file: either a bank-export CSV
or free-text notes with roughly one expense per line.

Today is {today}.
The user's spending categories are: {categories}.

Reply with ONLY a JSON object, no prose, in one of these two shapes:
  {{"expenses": [{{"row": 2, "amount": 12.5, "currency": "EUR", "merchant": "Rewe",
                   "category": "<a listed name>", "date": "2026-07-01"}}],
    "skipped": [{{"row": 5, "reason": "incoming payment, not an expense"}}]}}
  {{"unreadable": true}}

Rules:
- Banks differ: any delimiter, column order, header language, date format and
  number format (1.234,56 or 1,234.56) may appear — infer them from the data.
- For free-text notes, resolve relative dates against today; a line without a
  date means today.
- One entry per row/line that represents money SPENT. Use the absolute
  amount; amount must be positive. Default currency is EUR.
- row is the 1-based line number in the input, counting every line including
  any header.
- merchant is the counterparty/description, short and cleaned up.
- category MUST be one of the listed names, copied verbatim.
- Skip rows/lines that are credits/income, too vague, or missing a usable
  amount; report each under "skipped" with a short reason.
- If nothing in the content looks like expense data at all, reply
  {{"unreadable": true}}.
"""


async def _chat(messages: list[dict]) -> str:
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


def _extract_json(text: str) -> dict:
    """Parse the model reply, tolerating ```json fences or stray prose."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object in model reply: {text!r}")
    return json.loads(text[start : end + 1])


async def _ask(prompt_template: str, categories: list[str], user_content: str) -> dict:
    """One prompt round-trip; returns the model's JSON reply as a dict."""
    prompt = prompt_template.format(
        today=datetime.date.today().isoformat(),
        categories=", ".join(categories),
    )
    try:
        reply = await _chat(
            [
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_content},
            ]
        )
        return _extract_json(reply)
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise LlmUnavailableError(str(exc)) from exc


async def categorize(text: str, categories: list[str]) -> list[ParsedExpense]:
    """Extract one or more expenses from ``text``, filed into ``categories``."""
    payload = await _ask(_SYSTEM_PROMPT, categories, text)
    if payload.get("too_vague") or not payload.get("expenses"):
        raise TooVagueError
    try:
        return [ParsedExpense.model_validate(e) for e in payload["expenses"]]
    except ValidationError as exc:
        raise LlmUnavailableError(f"model returned an invalid expense: {exc}") from exc


async def parse_file(
    content: str, categories: list[str]
) -> tuple[list[RowExpense], list[SkippedRow]]:
    """Extract expenses from an uploaded bank CSV or free-text notes file."""
    payload = await _ask(_FILE_SYSTEM_PROMPT, categories, content)
    rows, skips = payload.get("expenses") or [], payload.get("skipped") or []
    # No usable rows *and* nothing skipped means the model saw no expense data.
    if payload.get("unreadable") or not (rows or skips):
        raise UnreadableFileError
    try:
        expenses = [RowExpense.model_validate(e) for e in rows]
        skipped = [SkippedRow.model_validate(s) for s in skips]
    except ValidationError as exc:
        raise LlmUnavailableError(f"model returned an invalid row: {exc}") from exc
    return expenses, skipped
