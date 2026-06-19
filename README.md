# ⚡ ExpenseFlow `v1.0` `by 99 Downtime`

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/AET-DevOps26/team-99-downtime?style=for-the-badge) ![GitHub branch check runs](https://img.shields.io/github/check-runs/AET-DevOps26/team-99-downtime/main?style=for-the-badge)

> [!WARNING]
> This project is still in development.

## Docs

- [Problem Statement](docs/problem/PROBLEM_STATEMENT.md)
- [Service Overview](docs/architecture/SERVICE_OVERVIEW.md) - UML / component / service diagrams + API calls diagrams
- [Developing with Auth](docs/development/AUTHENTICATION.md) - get a token, call secured endpoints, secure new ones

## Development Setup

There are two approaches to running the stack locally. Pick whichever fits your machine.

### Approach 1 - Docker

Runs the full stack (Postgres, Drizzle Studio, the Caddy gateway, and all app services) in containers with hot reload. Only requires Docker installed.

First, create `.env` from the example and fill in the secrets — without them the auth-service won't start:

```sh
cp .env.example .env
# set BETTER_AUTH_SECRET (openssl rand -base64 32) and the Google OAuth creds
```

```sh
docker compose up -d --build   # first run, or after a Dockerfile change
docker compose up -d           # any other time
```

Then open **http://localhost:9099** (the gateway). On a fresh `auth_db` the `auth-migrate` container applies the schema automatically before auth-service starts.

### Approach 2 - Bun + Nx (native)

Runs the apps natively on your host via Nx; only Postgres + Drizzle Studio in Docker. Faster startup and lighter on resources, but needs the toolchains installed (JDK 21, bun, uv for Python).

```sh
# Infra only
docker compose up -d postgres drizzle-studio

# Install deps (also sets up Git hooks via Husky) and launch all apps in parallel
bun install
bun dev
```

Run `bunx nx graph` to visually explore the workspace.

> Note: auth goes through the Caddy gateway (Approach 1). Native `nx serve` alone (no gateway) is fine for building/iterating, but the end-to-end auth flow needs the Docker stack.

### Endpoints

Use the app at **http://localhost:9099** — the Caddy gateway. It routes everything
behind one origin (see [`Caddyfile`](Caddyfile)):

| Path (via gateway) | Goes to              |
| ------------------ | -------------------- |
| `/`                | client (React)       |
| `/api/auth/*`      | auth-service         |
| `/transactions/*`  | transaction-service  |
| `/budgets/*`       | budget-service       |
| `/notifications/*` | notification-service |
| `/genai/*`         | genai-service        |

Each service's own port is still published for debugging (`auth` 3000,
`transaction` 8080, `notification` 8081, `budget` 8082, `genai` 8000),
plus Drizzle Studio (4983) and Postgres (5432).

### Verify it works

Open **http://localhost:9099** and sign up. Every backend service requires a Bearer JWT (`401` otherwise) and exposes `GET /api/me` as a probe. For the terminal smoke test (get a token, call a protected route) and the full auth workflow, see [Developing with Auth](docs/development/AUTHENTICATION.md).

### Drizzle Studio

Live database inspector included in the compose stack. Open **http://localhost:4983** — all three databases (`auth_db`, `transaction_db`, `budget_db`) are pre-configured and ready to browse.

## Deployment

### Stage (automatic)

Every push to `main` that produces a new release is automatically deployed to stage by the CD pipeline.

### Stage (manual)

```sh
bun deploy:k8s              # deploys latest git tag to t99-stage
bun deploy:k8s -n t99-prod  # target a different namespace
```

Reads the GitHub OAuth credentials from the existing cluster secret if present; prompts on first run.

### Production

Use the **Deploy to Production** workflow dispatch in GitHub Actions — pick the version tag to promote.

| Environment | App                                       | Studio                                           |
| ----------- | ----------------------------------------- | ------------------------------------------------ |
| Stage       | https://stage.t99.stud.k8s.aet.cit.tum.de | https://studio.stage.t99.stud.k8s.aet.cit.tum.de |
| Prod        | https://t99.stud.k8s.aet.cit.tum.de       | https://studio.t99.stud.k8s.aet.cit.tum.de       |

## Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to enforce code quality on every commit.

**pre-commit** — runs [lint-staged](https://github.com/lint-staged/lint-staged) on staged files:

| File type                                   | Tool                                       |
| ------------------------------------------- | ------------------------------------------ |
| `*.ts`, `*.tsx`                             | ESLint + Prettier                          |
| `*.js`, `*.json`, `*.md`, `*.yaml`, `*.yml` | Prettier                                   |
| `*.py`                                      | Ruff (format + lint)                       |
| `*.java`                                    | Spotless (Google Java Format) + Checkstyle |

**commit-msg** — enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint.

Commit message format: `<type>(<scope>): <subject>`

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

Examples:

```
feat(client): add expense list view
fix(budget-service): correct category limit calculation
chore: update dependencies
```

## Services

### Spring Boot services (Java 21 + Gradle)

| Service              | Path                                                      | Port |
| -------------------- | --------------------------------------------------------- | ---- |
| transaction-service  | [`apps/transaction-service/`](apps/transaction-service)   | 8080 |
| notification-service | [`apps/notification-service/`](apps/notification-service) | 8081 |
| budget-service       | [`apps/budget-service/`](apps/budget-service)             | 8082 |

**Prerequisites:** JDK 21+

To run an individual service (instead of `bun dev`):

```sh
bunx nx serve <service-name>     # or: cd apps/<service-name> && ./gradlew bootRun
```

Verify the health endpoint of each service:

```sh
curl http://localhost:8080/actuator/health   # transaction-service
curl http://localhost:8081/actuator/health   # notification-service
curl http://localhost:8082/actuator/health   # budget-service
# => {"status":"UP"}
```

Other Nx targets: `build`, `test` (e.g. `bunx nx build transaction-service`).

**Authentication:** all endpoints except `/actuator/health` require a Bearer JWT (`401` otherwise). See [Verify it works](#verify-it-works) for a quick token+probe, or [Developing with Auth](docs/development/AUTHENTICATION.md) for the full dev guide (getting tokens, the gateway path quirk, securing new endpoints).

### Client (React + Vite + Tailwind v4 + shadcn/ui)

| App    | Path                          | Port |
| ------ | ----------------------------- | ---- |
| client | [`apps/client/`](apps/client) | 4200 |

**Stack:** React 19, Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn/ui (new-york style, neutral base).

```sh
bunx nx build client      # production build -> dist/apps/client
bunx nx test client       # vitest
```

**Path alias:** `@/*` → `apps/client/src/*` (scoped to this app; defined in [`apps/client/tsconfig.json`](apps/client/tsconfig.json) for TypeScript and in [`apps/client/vite.config.mts`](apps/client/vite.config.mts) `resolve.alias` for the bundler). Import shared utilities like `import { cn } from '@/shared/lib/utils'`.

**Adding shadcn components:**

```sh
cd apps/client
bunx shadcn@latest add <component>      # e.g. card, input, dialog
```

Components land in `src/shared/ui/`. Configuration lives in [`apps/client/components.json`](apps/client/components.json). See [`apps/client/CLIENT_ARCHITECTURE.md`](apps/client/CLIENT_ARCHITECTURE.md) for the feature-first structure.

**Theming:** Tailwind v4 uses CSS-first config - design tokens (colors, radius, dark mode) are in [`apps/client/src/styles.css`](apps/client/src/styles.css). Add a `.dark` class to `<html>` to toggle dark mode. No `tailwind.config.js`.

### Auth service (Bun + Better Auth)

| App          | Path                                      | Port |
| ------------ | ----------------------------------------- | ---- |
| auth-service | [`apps/auth-service/`](apps/auth-service) | 3000 |

**Stack:** [Better Auth](https://better-auth.com/) on the Bun runtime, backed by its own `auth_db` Postgres database. Handles email+password and Google OAuth sign-in, and issues JWTs (via the `jwt()` plugin) that the backend services (Spring + genai) validate against the JWKS endpoint — see [`docs/architecture/SERVICE_OVERVIEW.md`](docs/architecture/SERVICE_OVERVIEW.md) §1.

```sh
bunx nx serve auth-service   # bun --watch, http://localhost:3000
bunx nx test auth-service    # bun test
```

**Config:** set `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in `.env` (see `.env.example`). `BETTER_AUTH_URL` is the browser-facing gateway origin (`http://localhost:9099`).

**Schema migration is automatic:** the `auth-migrate` container runs once on `docker compose up`, applies the Better Auth schema to `auth_db`, and exits; `auth-service` waits for it. No manual step. (Maps to a Kubernetes Job / initContainer in production.)

Key endpoints (under `/api/auth`): `GET /ok` (health), `GET /jwks`, `GET /token`, `POST /sign-up/email`, `POST /sign-in/email`, `GET /sign-in/social?provider=google`.

### GenAI service (Python + FastAPI)

| App           | Path                                        | Port |
| ------------- | ------------------------------------------- | ---- |
| genai-service | [`apps/genai-service/`](apps/genai-service) | 8000 |

**Stack:** FastAPI on Python (managed with [uv](https://docs.astral.sh/uv/)), served by uvicorn. Handles transaction categorization and summaries via LLM pipelines (currently a mock structured response).

```sh
bunx nx serve genai-service   # uvicorn --reload, http://localhost:8000
bunx nx test genai-service    # uv run pytest
```

**Endpoints:** `POST /analyze` and `GET /api/me` require a Bearer JWT; `GET /health` is public (container probe). Like the Spring services, it validates RS256 tokens against the auth-service JWKS and checks the issuer — see [Developing with Auth](docs/development/AUTHENTICATION.md).
