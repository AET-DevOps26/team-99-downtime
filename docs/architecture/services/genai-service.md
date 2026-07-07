# GenAI Service

**Responsibility:**
Handles transaction categorization and free-text/file expense parsing using an LLM backend (Logos gateway).

**Flow:**
Receive text or file content → call LLM → return structured expense objects with categories.

**Features:**

- Free-text expense extraction
- Bank CSV / plain-text file parsing
- Category suggestion from caller-supplied category list
- Weekly AI spending summaries (US-11), persisted per user and week

## API

| Method | Endpoint                      | Purpose                                                      |
| ------ | ----------------------------- | ------------------------------------------------------------ |
| POST   | `/api/genai/categorize`       | Extract structured expenses from a free-text sentence        |
| POST   | `/api/genai/parse-file`       | Extract one expense per row from a bank CSV or notes         |
| POST   | `/api/genai/summarize`        | Generate + store the weekly summary from a weekly report     |
| GET    | `/api/genai/summarize/latest` | Fetch the latest stored weekly summary                       |
| POST   | `/internal/summarize`         | Scheduler path (network-internal, not routed by the gateway) |
| GET    | `/api/genai/me`               | Auth probe — returns userId and email from JWT               |
| GET    | `/health`                     | Liveness check (public, no auth)                             |

### `POST /api/genai/categorize`

```json
// request
{ "text": "Spent 12.50 on coffee", "categories": ["Food", "Transport"] }

// response
{
  "expenses": [
    { "amount": 12.50, "currency": "EUR", "merchant": "Coffee Shop", "category": "Food", "date": "2026-07-04" }
  ]
}
```

Returns `422 TOO_VAGUE` when the model cannot extract a meaningful expense.

### `POST /api/genai/parse-file`

```json
// request
{ "content": "<csv or text content>", "categories": ["Food", "Transport"] }

// response
{
  "expenses": [
    { "row": 1, "amount": 12.50, "currency": "EUR", "merchant": "Coffee Shop", "category": "Food", "date": "2026-07-04" }
  ],
  "skipped": [{ "row": 3, "reason": "no amount found" }]
}
```

Returns `422 UNREADABLE_FILE` when the content contains no expense data at all.

### `POST /api/genai/summarize`

The caller supplies the week's numbers — the shape produced verbatim by
transaction-service's `GET /api/transactions/weekly-report`:

```json
// request
{
  "weekStart": "2026-06-29",
  "thisWeek": [
    { "date": "2026-06-29", "amount": 12.5, "currency": "EUR", "description": "Rewe" }
  ],
  "lastWeek": { "total": 41.2, "count": 4 }
}

// response
{
  "summary": "You spent 154.49 EUR across 5 expenses this week…",
  "weekStart": "2026-06-29",
  "generatedAt": "2026-07-04T05:10:12Z"
}
```

- `422 NOT_ENOUGH_DATA` — fewer than 3 transactions this week; nothing is stored,
  so a sparse week can never produce a misleading summary.
- `502 LLM_UNAVAILABLE` — gateway unreachable or unusable reply.
- `503 SUMMARY_STORE_UNAVAILABLE` — no `DATABASE_URL` configured.

### `GET /api/genai/summarize/latest`

Returns the newest stored summary for the calling user (same shape as above);
`404 NO_SUMMARY` before the first one exists.

### Weekly summaries: persistence + scheduler

Summaries are persisted in the service's own `genai_db`
(`weekly_summaries`, unique per user + `weekStart`; regenerating overwrites).
The weekly scheduler lives in **transaction-service** (the data owner): a cron
holds no user JWT, so it builds each active user's report from its own database
and posts it — with the target `userId` in the body — to `/internal/summarize`.
That route is reachable only inside the compose/cluster network, because the
gateway routes just `/api/genai*` to this service; it is hidden from the
OpenAPI spec.

## Configuration

| Env var               | Default                                  | Description                      |
| --------------------- | ---------------------------------------- | -------------------------------- |
| `AUTH_JWKS_URI`       | `http://auth-service:3000/api/auth/jwks` | JWKS endpoint for JWT validation |
| `AUTH_ISSUER`         | `http://localhost:9099`                  | Expected JWT issuer              |
| `LLM_API_KEY`         | —                                        | Logos gateway key                |
| `LLM_BASE_URL`        | `https://logos.aet.cit.tum.de:8080/v1`   | LLM base URL                     |
| `LLM_MODEL`           | `openai/gpt-oss-120b`                    | Model identifier                 |
| `LLM_TIMEOUT_SECONDS` | `30`                                     | LLM request timeout (s)          |
| `DATABASE_URL`        | — (empty = summary routes answer 503)    | Postgres DSN for `genai_db`      |
