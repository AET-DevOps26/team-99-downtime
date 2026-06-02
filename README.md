# ⚡ ExpenseFlow `v1.0` `by 99 Downtime`

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/AET-DevOps26/team-99-downtime?style=for-the-badge) ![GitHub branch check runs](https://img.shields.io/github/check-runs/AET-DevOps26/team-99-downtime/main?style=for-the-badge) ![Swagger Validator](https://img.shields.io/swagger/valid/3.0?specUrl=https%3A%2F%2Fraw.githubusercontent.com%2FOAI%2FOpenAPI-Specification%2Fc442afe06ec28443df0c69d01dc38c54968b246f%2Fexamples%2Fv2.0%2Fjson%2Fpetstore-expanded.json&style=for-the-badge)

> [!WARNING]
> This project is still in development.

## Docs

- [Problem Statement](docs/problem/PROBLEM_STATEMENT.md)
- [Service Overview](docs/architecture/SERVICE_OVERVIEW.md) - UML / component / service diagrams + API calls diagrams

## Development Setup

There are two approaches to running the stack locally. Pick whichever fits your machine.

### Approach 1 - Docker

Runs the full stack (Postgres, pgAdmin, all 5 services) in containers with hot reload. Only requires Docker installed.

```sh
docker compose up -d --build   # first run, or after a Dockerfile change
docker compose up -d           # any other time
```

Configure credentials and ports via `.env` (see `.env.example`).

### Approach 2 - Bun + Nx (native)

Runs the apps natively on your host via Nx; only Postgres + pgAdmin in Docker. Faster startup and lighter on resources, but needs the toolchains installed (JDK 21, bun, uv for Python).

```sh
# Infra only
docker compose up -d postgres pgadmin

# Install deps (also sets up Git hooks via Husky) and launch all apps in parallel
bun install
bun dev
```

Run `bunx nx graph` to visually explore the workspace.

### Endpoints (either approach)

| Service              | URL                   |
| -------------------- | --------------------- |
| client               | http://localhost:4200 |
| auth-service         | http://localhost:3000 |
| transaction-service  | http://localhost:8080 |
| notification-service | http://localhost:8081 |
| budget-service       | http://localhost:8082 |
| genai-service        | http://localhost:8000 |
| pgAdmin              | http://localhost:5050 |
| Postgres             | localhost:5432        |

### pgAdmin

Web UI for Postgres, included in the compose stack for browsing schemas and running ad-hoc queries. Open http://localhost:5050 and log in:

- **Email:** `dev@team99.dev`
- **Password:** `devpass`

First time only, register the Postgres server: right-click **Servers** -> **Register** -> **Server...**

- **Name:** anything (e.g. `team99`)
- **Connection** tab:
  - Host: `postgres`
  - Port: `5432`
  - Maintenance database: `postgres`
  - Username: `devuser`
  - Password: `devpass`

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

**Authentication:** all endpoints except `/actuator/health` require a Bearer JWT from the auth-service (`401` otherwise). See the auth-service section for how to get a token.

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

Components land in `src/shared/ui/`. Configuration lives in [`apps/client/components.json`](apps/client/components.json). See [`apps/client/ARCHITECTURE.md`](apps/client/ARCHITECTURE.md) for the feature-first structure.

**Theming:** Tailwind v4 uses CSS-first config - design tokens (colors, radius, dark mode) are in [`apps/client/src/styles.css`](apps/client/src/styles.css). Add a `.dark` class to `<html>` to toggle dark mode. No `tailwind.config.js`.

### Auth service (Bun + Better Auth)

| App          | Path                                      | Port |
| ------------ | ----------------------------------------- | ---- |
| auth-service | [`apps/auth-service/`](apps/auth-service) | 3000 |

**Stack:** [Better Auth](https://better-auth.com/) on the Bun runtime, backed by its own `auth_db` Postgres database. Handles email+password and Google OAuth sign-in, and issues JWTs (via the `jwt()` plugin) that the Spring services validate against the JWKS endpoint — see [`docs/architecture/SERVICE_OVERVIEW.md`](docs/architecture/SERVICE_OVERVIEW.md) §1.

```sh
bunx nx serve auth-service   # bun --watch, http://localhost:3000
bunx nx test auth-service    # bun test
```

**Config:** set `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in `.env` (see `.env.example`). First-time setup needs the schema migrated into `auth_db`:

```sh
cd apps/auth-service && bunx @better-auth/cli@latest migrate --config src/auth.ts -y
```

Key endpoints (under `/api/auth`): `GET /ok` (health), `GET /jwks`, `GET /token`, `POST /sign-up/email`, `POST /sign-in/email`, `GET /sign-in/social?provider=google`.
