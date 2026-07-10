# Development Setup

## Running the Stack

There are two approaches. Pick whichever fits your machine.

### Approach 1 — Docker (recommended)

Runs the full stack (Postgres, Drizzle Studio, the Caddy gateway, and all app services) in containers with hot reload. Only requires Docker.

```sh
cp .env.example .env
# set BETTER_AUTH_SECRET (openssl rand -base64 32) and the Google OAuth creds

docker compose up -d --build   # first run, or after a Dockerfile change
docker compose up -d           # any other time
```

Open **http://localhost:9099** (the gateway). On a fresh `auth_db` the `auth-migrate` container applies the schema automatically before auth-service starts.

### Approach 2 — Bun + Nx (native)

Runs apps natively via Nx; only Postgres + Drizzle Studio in Docker. Faster startup and lighter on resources, but needs the toolchains installed (JDK 21, bun, uv for Python).

```sh
# Infra only
docker compose up -d postgres drizzle-studio

# Install deps (also sets up Git hooks via Husky) and launch all apps in parallel
bun install
bun dev
```

Run `bunx nx graph` to visually explore the workspace.

> Note: auth goes through the Caddy gateway (Approach 1). Native `nx serve` alone (no gateway) is fine for building/iterating, but the end-to-end auth flow needs the Docker stack.

## Local Endpoints

Use the app at **http://localhost:9099** — the Caddy gateway routes everything behind one origin (see [`Caddyfile`](../../Caddyfile)):

| Path (via gateway)     | Goes to              |
| ---------------------- | -------------------- |
| `/`                    | client (React)       |
| `/api/auth/*`          | auth-service         |
| `/api/transactions/*`  | transaction-service  |
| `/api/budgets/*`       | budget-service       |
| `/api/notifications/*` | notification-service |
| `/api/genai/*`         | genai-service        |

Each service's own port is still published for debugging (`auth` 3000, `transaction` 8080, `notification` 8081, `budget` 8082, `genai` 8000), plus Drizzle Studio (4983) and Postgres (5432).

## Verify It Works

Open **http://localhost:9099** and sign up. Every backend service requires a Bearer JWT (`401` otherwise) and exposes a `/me` probe at its own prefix (e.g. `GET /api/budgets/me`). For the terminal smoke test and the full auth dev workflow see [AUTHENTICATION.md](AUTHENTICATION.md).

## Drizzle Studio

Live database inspector included in the compose stack. Open **http://localhost:4983** — all databases (`auth_db`, `transaction_db`, `budget_db`, `notification_db`) are pre-configured and ready to browse.

## Services

### Spring Boot Services (Java 21 + Gradle)

| Service              | Path                                                            | Port |
| -------------------- | --------------------------------------------------------------- | ---- |
| transaction-service  | [`apps/transaction-service/`](../../apps/transaction-service)   | 8080 |
| notification-service | [`apps/notification-service/`](../../apps/notification-service) | 8081 |
| budget-service       | [`apps/budget-service/`](../../apps/budget-service)             | 8082 |

**Prerequisites:** JDK 21+

```sh
bunx nx serve <service-name>     # or: cd apps/<service-name> && ./gradlew bootRun
```

Health check:

```sh
curl http://localhost:8080/actuator/health   # transaction-service
curl http://localhost:8081/actuator/health   # notification-service
curl http://localhost:8082/actuator/health   # budget-service
# => {"status":"UP"}
```

Other Nx targets: `build`, `test` (e.g. `bunx nx build transaction-service`).

All endpoints except `/actuator/health` require a Bearer JWT. See [AUTHENTICATION.md](AUTHENTICATION.md) for the full dev guide.

### Database Migrations (Flyway)

`budget-service`, `transaction-service`, and `notification-service` use [Flyway](https://flywaydb.org/) for schema management. Migration files live at:

```
apps/<service>/src/main/resources/db/migration/
  V1__init.sql          ← initial schema (already committed)
  V2__seed_demo_data.sql
  V3__your_change.sql   ← you write this
```

**When you change a JPA entity** (add a column, new table, index, etc.) you must write a migration:

1. Create `V{n}__describe_the_change.sql` in the service's `db/migration/` directory — version must be strictly higher than the previous file.
2. Use backwards-compatible SQL (add nullable columns, use `CREATE INDEX CONCURRENTLY`, never drop or rename live columns). squawk enforces this automatically.
3. Never edit an already-committed migration — Flyway checksums every file and will refuse to start if one changes.

**Flyway does not auto-generate migrations from JPA entities.** You write the SQL yourself. Hibernate is set to `ddl-auto: validate` in production — it checks that the schema matches the entities but never modifies it. If you forget the migration, the service will fail to start with a schema validation error, which is the safety net.

**squawk** lints your migration for backwards-incompatible patterns (drop column, NOT NULL without a default, non-concurrent index creation, rename). It runs automatically on pre-push (via `bunx`) and in CI — no installation needed.

To lint manually:

```sh
bunx squawk-cli apps/budget-service/src/main/resources/db/migration/V3__my_change.sql
```

**Tests** use H2 with `ddl-auto: create-drop` — Flyway is disabled in the test profile so you don't need a Postgres instance to run tests.

### Regenerating the OpenAPI Specs + Frontend Client

Every service describes its API as an OpenAPI spec, and the frontend's typed client is generated from those specs — both at build time, straight from the code. Whenever you add or change an endpoint or DTO:

```sh
bun run openapi          # no stack needed — refresh openapi/*.json + apps/client/src/shared/api/generated
```

Then commit the regenerated `openapi/` and `generated/` files with your change — the `openapi-drift` CI job fails the PR if you forget. See [API_CLIENTS.md](API_CLIENTS.md) for details.

### Client (React + Vite + Tailwind v4 + shadcn/ui)

| App    | Path                                | Port |
| ------ | ----------------------------------- | ---- |
| client | [`apps/client/`](../../apps/client) | 4200 |

**Stack:** React 19, Vite 8, Tailwind CSS v4, shadcn/ui (new-york style, neutral base).

```sh
bunx nx build client      # production build -> dist/apps/client
bunx nx test client       # vitest
```

**Path alias:** `@/*` → `apps/client/src/*`. Import shared utilities like `import { cn } from '@/shared/lib/utils'`.

**Adding shadcn components:**

```sh
cd apps/client
bunx shadcn@latest add <component>      # e.g. card, input, dialog
```

Components land in `src/shared/ui/`. See [`apps/client/CLIENT_ARCHITECTURE.md`](../../apps/client/CLIENT_ARCHITECTURE.md) for the feature-first structure.

**Theming:** Tailwind v4 uses CSS-first config — design tokens are in [`apps/client/src/styles.css`](../../apps/client/src/styles.css). Add a `.dark` class to `<html>` to toggle dark mode.

### Auth Service (Bun + Better Auth)

| App          | Path                                            | Port |
| ------------ | ----------------------------------------------- | ---- |
| auth-service | [`apps/auth-service/`](../../apps/auth-service) | 3000 |

**Stack:** [Better Auth](https://better-auth.com/) on the Bun runtime, backed by its own `auth_db` Postgres database. Issues JWTs (RS256) that all backend services validate against the JWKS endpoint.

```sh
bunx nx serve auth-service   # bun --watch, http://localhost:3000
bunx nx test auth-service    # bun test
```

**Config:** set `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in `.env`. `BETTER_AUTH_URL` is the browser-facing gateway origin (`http://localhost:9099`).

Schema migration is automatic — the `auth-migrate` container runs on `docker compose up`, applies the Better Auth schema, and exits before auth-service starts.

Key endpoints (under `/api/auth`): `GET /ok`, `GET /jwks`, `GET /token`, `POST /sign-up/email`, `POST /sign-in/email`, `GET /sign-in/social?provider=google`.

### GenAI Service (Python + FastAPI)

| App           | Path                                              | Port |
| ------------- | ------------------------------------------------- | ---- |
| genai-service | [`apps/genai-service/`](../../apps/genai-service) | 8000 |

**Stack:** FastAPI on Python (managed with [uv](https://docs.astral.sh/uv/)), served by uvicorn.

```sh
bunx nx serve genai-service   # uvicorn --reload, http://localhost:8000
bunx nx test genai-service    # uv run pytest
```

Endpoints `POST /api/genai/analyze` and `GET /api/genai/me` require a Bearer JWT; `GET /health` is public.

## Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to enforce code quality on every commit.

**pre-commit** — runs [lint-staged](https://github.com/lint-staged/lint-staged) on staged files:

| File type                                   | Tool                                       |
| ------------------------------------------- | ------------------------------------------ |
| `*.ts`, `*.tsx`                             | ESLint + Prettier                          |
| `*.js`, `*.json`, `*.md`, `*.yaml`, `*.yml` | Prettier                                   |
| `*.py`                                      | Ruff (format + lint)                       |
| `*.java`                                    | Spotless (Google Java Format) + Checkstyle |

**pre-push** — runs before every `git push`:

1. **squawk** lints any SQL migration files changed relative to `origin/main` via `bunx squawk-cli` — no installation needed.
2. **OpenAPI drift check** — if any Java controller/DTO, Python route, or `apps/auth-service/src/auth.ts` changed, regenerates all specs (`bun run openapi`) and fails if the committed files are out of date. This is scoped to avoid the Gradle startup cost on unrelated pushes.
3. **`nx affected -t test`** runs tests for all projects affected by the push.

**commit-msg** — enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint.

Format: `<type>(<scope>): <subject>`

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

Examples:

```
feat(client): add expense list view
fix(budget-service): correct category limit calculation
chore: update dependencies
```
