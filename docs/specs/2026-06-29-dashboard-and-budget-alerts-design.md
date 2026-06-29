# Design: Dashboard View + Budget Alerts (US-6 & US-10)

**Date:** 2026-06-29
**Issues:** [#21 (US-6)](https://github.com/AET-DevOps26/team-99-downtime/issues/21), [#23 (US-10)](https://github.com/AET-DevOps26/team-99-downtime/issues/23)
**Branch:** single feature branch covering both user stories

---

## Summary

Two user stories implemented together because US-10's threshold check depends on the transaction write path established in US-6.

- **US-6**: Dashboard showing recent transactions + spend-vs-limit per category + remaining budget total.
- **US-10**: Budget alerts at 80% and 100% of a category limit, fired once per threshold per category per month, delivered in-app via SSE.

---

## Data Flow

### US-6 — Dashboard load

```
Client → GET /api/transactions          → transaction-service (paginated, date desc)
Client → GET /api/budgets/status        → budget-service
                                            → GET /api/transactions/spend (forwards JWT)
                                            → transaction-service returns [{ categoryId, totalSpent }]
                                            → joins with user's categories + limits
                                            → returns status per category
```

### US-10 — Transaction write triggers alert

```
Client → POST|PATCH|DELETE /api/transactions/{...} → transaction-service
                                                      → stores/updates/removes transaction
                                                      → fire-and-forget POST /api/budgets/threshold-check (forwards JWT)
                                                           → budget-service: GET /api/transactions/spend (forwards JWT)
                                                           → checks ThresholdFlag table (no double-fire this month)
                                                           → if new crossing: POST /api/notifications (forwards JWT)
                                                                → notification-service stores notification
                                                                → pushes SSE event to user's open stream

Client → GET /api/notifications/stream  → notification-service SSE (persistent, Header bell)
```

### JWT forwarding

Every service-to-service call forwards the original user JWT in `Authorization: Bearer`. Each service validates it independently via the shared JWKS (`/api/auth/jwks`). No internal trust, no service accounts.

---

## Backend

### transaction-service (built from scratch)

Follows the `budget-service` shape defined in `apps/JAVA_ARCHITECTURE.md`.

**`Transaction` entity**

| Field         | Type          | Notes                          |
| ------------- | ------------- | ------------------------------ |
| `id`          | UUID          | generated                      |
| `userId`      | String        | JWT subject, never from body   |
| `categoryId`  | UUID          | from budget-service categories |
| `amount`      | BigDecimal    | precision 12, scale 2          |
| `currency`    | String        | default `"EUR"`                |
| `description` | String        |                                |
| `date`        | LocalDate     | user-supplied transaction date |
| `createdAt`   | LocalDateTime | set on insert                  |

Category matching uses the UUID only — transaction-service has no schema dependency on budget-service. If a category is deleted, its historical transactions are orphaned silently (excluded from budget status). This is acceptable: deleting a category is a destructive user action.

**Endpoints**

| Method   | Path                      | Notes                                                                                                                                            |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/transactions`       | paginated (`page`, `size`), sorted `date desc`, scoped to `userId`                                                                               |
| `POST`   | `/api/transactions`       | create; fire-and-forget threshold-check after write                                                                                              |
| `PATCH`  | `/api/transactions/{id}`  | update; fire-and-forget threshold-check after write                                                                                              |
| `DELETE` | `/api/transactions/{id}`  | delete; fire-and-forget threshold-check after write                                                                                              |
| `GET`    | `/api/transactions/spend` | **internal** — called by budget-service; returns `[{ categoryId, totalSpent }]` for the current calendar month, scoped to authenticated `userId` |

The threshold-check call is fire-and-forget (`@Async` / non-blocking): the client response is not delayed by downstream budget or notification calls.

---

### budget-service (additions)

**New entity: `ThresholdFlag`**

| Field        | Type          | Notes                                                                   |
| ------------ | ------------- | ----------------------------------------------------------------------- |
| `id`         | UUID          | generated                                                               |
| `userId`     | String        |                                                                         |
| `categoryId` | UUID          |                                                                         |
| `month`      | String        | `"YYYY-MM"` — month rollover = no existing flag = threshold fires fresh |
| `threshold`  | int           | `80` or `100`                                                           |
| `firedAt`    | LocalDateTime |                                                                         |

Unique constraint on `(userId, categoryId, month, threshold)` — prevents double-fire at the DB level even under concurrent writes.

**New endpoints**

| Method | Path                           | Notes                                                                                                                                                      |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/budgets/status`          | calls `GET /api/transactions/spend` (forwards JWT), joins with all of the user's categories (including those with zero spend), returns per-category status |
| `POST` | `/api/budgets/threshold-check` | called by transaction-service; checks crossings, persists `ThresholdFlag`, calls notification-service if newly crossed; returns 204                        |

**`GET /api/budgets/status` response shape (per category)**

```json
{
  "categoryId": "uuid",
  "name": "Groceries",
  "monthlyLimit": 300.0,
  "spent": 245.0,
  "remaining": 55.0,
  "percentUsed": 81.67
}
```

**Threshold-check logic**

1. Call `GET /api/transactions/spend` (forward JWT) to get current-month spend per categoryId.
2. For each category: compute `percentUsed = spent / monthlyLimit * 100`.
3. For each threshold `[80, 100]`: if `percentUsed >= threshold` AND no `ThresholdFlag` exists for `(userId, categoryId, currentMonth, threshold)`:
   - Insert `ThresholdFlag`.
   - Call `POST /api/notifications` (forward JWT) with payload.

---

### notification-service (built from scratch)

Follows the `budget-service` shape.

**`Notification` entity**

| Field          | Type          | Notes                                                           |
| -------------- | ------------- | --------------------------------------------------------------- |
| `id`           | UUID          | generated                                                       |
| `userId`       | String        |                                                                 |
| `categoryId`   | UUID          |                                                                 |
| `categoryName` | String        | denormalized at creation time — survives category rename/delete |
| `threshold`    | int           | `80` or `100`                                                   |
| `percentUsed`  | BigDecimal    |                                                                 |
| `amountLeft`   | BigDecimal    |                                                                 |
| `createdAt`    | LocalDateTime |                                                                 |
| `readAt`       | LocalDateTime | nullable; null = unread                                         |

**Endpoints**

| Method  | Path                           | Notes                                                                                                 |
| ------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `POST`  | `/api/notifications`           | called by budget-service; stores notification, pushes SSE event to user's open streams                |
| `GET`   | `/api/notifications`           | returns user's notifications sorted `readAt IS NULL DESC, createdAt DESC` (unread first, then newest) |
| `PATCH` | `/api/notifications/{id}/read` | sets `readAt = now()`                                                                                 |
| `GET`   | `/api/notifications/stream`    | SSE; registers `SseEmitter` for the user; `text/event-stream`                                         |

**SSE session management**

`NotificationStreamService` holds `Map<userId, List<SseEmitter>>`. On `POST /api/notifications`, it iterates the user's emitters and sends the new notification as a JSON SSE event. Stale/completed emitters are removed on error. Emitters time out after a configurable TTL (default: 5 minutes); `EventSource` auto-reconnects.

**SSE event payload**

```json
{
  "id": "uuid",
  "categoryName": "Groceries",
  "threshold": 80,
  "percentUsed": 81.67,
  "amountLeft": 55.0,
  "createdAt": "2026-06-29T14:00:00"
}
```

---

## Frontend

### App shell (all currently `null` stubs)

- **`AppLayout`** — renders `<Sidebar>` + `<Header>` + `<Outlet>`
- **`Sidebar`** — navigation: Dashboard, Transactions. "Manage Categories" button opens existing `ManageCategoriesModal`.
- **`Header`** — wordmark left, `NotificationBell` right.

### New feature modules

**`features/transactions/`**

- `api/transactionApi.ts` — `listTransactions(page, size)`, `createTransaction(input)`, `updateTransaction(id, input)`, `deleteTransaction(id)`
- `hooks/useTransactions.ts` — paginated load; exposes `{ transactions, loading, error, page, setPage, totalPages }`
- Update `index.ts`

**`features/budgets/`**

- `api/budgetApi.ts` — add `getBudgetStatus()`
- `hooks/useBudgetStatus.ts` — exposes `{ categories, totalRemaining, loading, error }`
- Update `index.ts`

**`features/notifications/`** (new feature folder)

- `api/notificationApi.ts` — `listNotifications()`, `markAsRead(id)`
- `hooks/useNotifications.ts` — fetch on mount; exposes `{ notifications, unreadCount, markAsRead, append }`
- `hooks/useNotificationStream.ts` — opens `EventSource` to `/api/notifications/stream`; on message, calls `append` from `useNotifications`; closes on unmount
- `ui/NotificationBell.tsx` — bell icon with unread badge; dropdown lists notifications; click marks as read
- `index.ts`

### Pages

**`DashboardPage`**

- Composes two widgets side by side (or stacked on small screens):
  - `RecentTransactions` (`features/dashboard/ui/`) — fetches `GET /api/transactions?page=0&size=5`; displays date, description, category name, amount. Category name is resolved client-side by cross-referencing the category list (already loaded by `useBudgetStatus`). Empty state when no transactions.
  - `BudgetBars` (`features/dashboard/ui/`) — one progress bar per category (spent / limit); bar turns red at ≥ 80%. Total remaining budget shown below.
- Each widget has a loading skeleton and an error state.
- `Header` mounts `useNotificationStream` here (SSE connection active while dashboard is open).

**`TransactionsPage`**

- Full paginated table via `useTransactions`.
- Previous / next pagination controls.
- "Add expense" button opens `AddExpenseModal`.

**`AddExpenseModal`** (implements existing stub)

- Fields: description (text), amount (number), date (date picker, default today), category (existing `CategoryPicker`).
- On submit: `createTransaction(input)`.

---

## Tests

**transaction-service**

- Unit: `TransactionService` spend calculation for current month only.
- Integration: `POST /api/transactions` → verify spend endpoint reflects the new amount.

**budget-service**

- Unit: threshold detection — no double-fire within same month; fires fresh on new month; fires at exactly 80% and 100%.
- Integration: transaction → threshold-check → notification created (mock notification-service).

**notification-service**

- Unit: `readAt` is set correctly on mark-as-read; unread-first ordering.

**Frontend**

- `DashboardPage`: renders empty state when transactions list is empty; renders budget bars when status is populated.
- `NotificationBell`: shows unread count badge; clears on mark-as-read.

---

## Out of scope for this branch

- `GET /api/transactions/{id}` (single transaction) — not needed by either user story.
- CSV/text import (`POST /api/transactions/import`) — separate feature.
- GenAI categorization — separate feature.
- `TransactionsPage` filtering — separate feature.
- Push notifications (email, mobile) — out of scope per issue.
