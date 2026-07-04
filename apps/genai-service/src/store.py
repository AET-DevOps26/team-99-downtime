"""Persistence for generated weekly summaries (asyncpg on genai_db).

The store is optional infrastructure: with DATABASE_URL unset (bare local runs,
unit tests) the app still serves categorize/parse-file and the summary routes
answer 503. Tests exercise the API with an in-memory fake instead of Postgres.
"""

import dataclasses
import datetime

import asyncpg

# One row per (user, week); regenerating a week overwrites its summary.
_SCHEMA = """\
CREATE TABLE IF NOT EXISTS weekly_summaries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    week_start DATE NOT NULL,
    summary TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start)
)
"""


@dataclasses.dataclass(frozen=True)
class StoredSummary:
    """A persisted summary, as the API returns it."""

    summary: str
    week_start: datetime.date
    generated_at: datetime.datetime


class SummaryStore:
    """Weekly summaries keyed by (user, week start)."""

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    @classmethod
    async def connect(cls, dsn: str) -> "SummaryStore":
        pool = await asyncpg.create_pool(dsn)
        async with pool.acquire() as conn:
            await conn.execute(_SCHEMA)
        return cls(pool)

    async def close(self) -> None:
        await self._pool.close()

    async def upsert(
        self, user_id: str, week_start: datetime.date, summary: str
    ) -> StoredSummary:
        row = await self._pool.fetchrow(
            """
            INSERT INTO weekly_summaries (user_id, week_start, summary)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, week_start)
            DO UPDATE SET summary = EXCLUDED.summary, generated_at = now()
            RETURNING summary, week_start, generated_at
            """,
            user_id,
            week_start,
            summary,
        )
        return StoredSummary(**dict(row))

    async def latest(self, user_id: str) -> StoredSummary | None:
        row = await self._pool.fetchrow(
            """
            SELECT summary, week_start, generated_at
            FROM weekly_summaries
            WHERE user_id = $1
            ORDER BY week_start DESC
            LIMIT 1
            """,
            user_id,
        )
        return StoredSummary(**dict(row)) if row else None
