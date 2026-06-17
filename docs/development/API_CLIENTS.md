# 🔁 OpenAPI specs & generated clients

Every backend describes its HTTP API as an **OpenAPI 3 spec**, and the React
client's types are **generated from those specs** — so the frontend and backend
can't silently drift. You write a Spring controller (or a FastAPI route), run one
command, and the typed client updates to match.

For _how_ to call secured endpoints (tokens, the gateway path quirk), see
[`AUTHENTICATION.md`](AUTHENTICATION.md). This guide is about the contract.

---

## Mental model (30 seconds)

```
Spring / FastAPI code  ──►  live /v3/api-docs (or /openapi.json)  ──►  openapi/<service>.json  ──►  generated/<service>.ts
     (source of truth)        (served by the running service)          (committed spec)              (committed, generated types)
```

- **Spring services** serve their spec at `/v3/api-docs` via springdoc; **FastAPI**
  serves it at `/openapi.json` — both built automatically from the code.
- One script fetches each live spec, saves it to `openapi/`, and runs
  [`openapi-typescript`](https://openapi-ts.dev/) to emit a `.ts` module of
  `paths`/`components` types.
- Both the specs (`openapi/`) and the generated client
  (`apps/client/src/shared/api/generated/`) are **committed** so reviewers see the
  contract change in the diff and the client builds with no extra steps.

---

## Regenerating after an API change

Codegen reads the specs from the **running** services, so start the stack first:

```sh
docker compose up -d     # or `bun dev` — whichever you use
bun run openapi          # fetch live specs -> openapi/*.json -> generated client
```

Commit the regenerated `openapi/*.json` and `generated/*.ts` alongside your code
change. If a service isn't up, the script tells you which one and exits non-zero.

---

## Browsing the APIs (one Swagger UI)

With the stack up, a **single** Swagger UI behind the gateway shows every
service's API, with a dropdown to switch between them:

**http://localhost:9099/docs/**

There are intentionally no per-service Swagger UIs — the Spring services use
springdoc's `-api` starter (spec only, no UI webjar) and FastAPI's `/docs` is
disabled. Each service still serves its raw spec for the aggregated UI and the
codegen:

| Service              | Raw spec (via gateway, same origin) |
| -------------------- | ----------------------------------- |
| budget-service       | `/budgets/v3/api-docs`              |
| transaction-service  | `/transactions/v3/api-docs`         |
| notification-service | `/notifications/v3/api-docs`        |
| genai-service        | `/genai/openapi.json`               |

Use the **Authorize** button (scheme `bearerAuth`) to paste a JWT and try secured
endpoints — get a token per [`AUTHENTICATION.md`](AUTHENTICATION.md).

---

## Using the generated types in the client

The generated modules expose `components['schemas'][...]`. The feature API
wrappers derive their request/response types from them instead of re-declaring
shapes — see [`apps/client/src/features/budgets/api/budgetApi.ts`](../../apps/client/src/features/budgets/api/budgetApi.ts):

```ts
import type { components } from '@/shared/api/generated/budget-service';

// Response fields are typed optional in the spec (no @NonNull on the record),
// but the server always sends them, so re-require for ergonomic consumers.
export type Category = Required<components['schemas']['CategoryResponse']>;
export type CategoryInput = components['schemas']['CategoryRequest'];
```

The existing `apiFetch` wrapper still handles the bearer token and the gateway
prefix — codegen only replaces the hand-maintained type definitions.

---

## How it's wired

- **Spring:** the `springdoc-openapi-starter-webmvc-api` dependency is declared
  once in [`commons-jvm`](../../apps/commons-jvm/build.gradle.kts), so every
  service exposes `/v3/api-docs` automatically (the `-api` starter omits the
  per-service Swagger UI). A shared `OpenApiConfig` adds the `bearerAuth` JWT
  security scheme and titles each spec by service name; `SecurityConfig` permits
  the docs route.
- **FastAPI:** serves `/openapi.json` out of the box; its `/docs` is disabled in
  `main.py`.
- **Aggregated UI:** the `swagger-ui` container in
  [`docker-compose.yaml`](../../docker-compose.yaml) is configured with every
  service's spec URL and proxied by the gateway at `/docs` (see the `handle /docs*`
  block in [`Caddyfile`](../../Caddyfile)).
- **Codegen:** [`tools/openapi/generate.mjs`](../../tools/openapi/generate.mjs)
  fetches each service's live spec and runs `openapi-typescript` over it.

Adding a service? Add its `name -> spec URL` to the `services` map in
`tools/openapi/generate.mjs`; the spec and client are picked up with no further
wiring.
