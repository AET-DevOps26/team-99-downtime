# GenAI Service

**Responsibility:**
Handles transaction categorization and free-text/file expense parsing using an LLM backend (Logos gateway).

**Flow:**
Receive text or file content → call LLM → return structured expense objects with categories.

**Features:**

- Free-text expense extraction
- Bank CSV / plain-text file parsing
- Category suggestion from caller-supplied category list

## API

| Method | Endpoint                | Purpose                                               |
| ------ | ----------------------- | ----------------------------------------------------- |
| POST   | `/api/genai/categorize` | Extract structured expenses from a free-text sentence |
| POST   | `/api/genai/parse-file` | Extract one expense per row from a bank CSV or notes  |
| GET    | `/api/genai/me`         | Auth probe — returns userId and email from JWT        |
| GET    | `/health`               | Liveness check (public, no auth)                      |

### `POST /api/genai/categorize`

```json
// request
{ "text": "Spent 12.50 on coffee", "categories": ["Food", "Transport"] }

// response
{ "expenses": [{ "amount": 12.50, "description": "coffee", "category": "Food" }] }
```

Returns `422 TOO_VAGUE` when the model cannot extract a meaningful expense.

### `POST /api/genai/parse-file`

```json
// request
{ "content": "<csv or text content>", "categories": ["Food", "Transport"] }

// response
{
  "expenses": [{ "amount": 12.50, "description": "coffee", "category": "Food" }],
  "skipped": [{ "row": "some unparseable line", "reason": "..." }]
}
```

Returns `422 UNREADABLE_FILE` when the content contains no expense data at all.

## Configuration

| Env var        | Default                                | Description       |
| -------------- | -------------------------------------- | ----------------- |
| `LLM_API_KEY`  | —                                      | Logos gateway key |
| `LLM_BASE_URL` | `https://logos.aet.cit.tum.de:8080/v1` | LLM base URL      |
| `LLM_MODEL`    | `openai/gpt-oss-120b`                  | Model identifier  |
