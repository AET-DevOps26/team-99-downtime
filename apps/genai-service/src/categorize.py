"""Free-text expense extraction via the Logos LLM gateway.

The model gets the user's sentence plus their existing category names and must
answer with strict JSON: either a list of expenses or a too-vague marker. A
deliberate model refusal surfaces as TooVagueError (the API's preset 422);
network trouble or a malformed reply surfaces as LlmUnavailableError (502).
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


class TooVagueError(Exception):
    """The sentence lacks the detail needed to extract an expense."""


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


async def categorize(text: str, categories: list[str]) -> list[ParsedExpense]:
    """Extract one or more expenses from ``text``, filed into ``categories``."""
    prompt = _SYSTEM_PROMPT.format(
        today=datetime.date.today().isoformat(),
        categories=", ".join(categories),
    )
    try:
        reply = await _chat(
            [
                {"role": "system", "content": prompt},
                {"role": "user", "content": text},
            ]
        )
        payload = _extract_json(reply)
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise LlmUnavailableError(str(exc)) from exc

    if payload.get("too_vague") or not payload.get("expenses"):
        raise TooVagueError
    try:
        return [ParsedExpense.model_validate(e) for e in payload["expenses"]]
    except ValidationError as exc:
        raise LlmUnavailableError(f"model returned an invalid expense: {exc}") from exc
