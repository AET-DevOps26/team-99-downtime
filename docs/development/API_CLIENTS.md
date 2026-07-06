# 🔁 OpenAPI specs & the typed client

Every backend describes its HTTP API as an **OpenAPI 3 spec**, and the React
client calls the services through a **fully typed client generated from those
specs** — the frontend and backend can't silently drift. You write a Spring
controller (or a FastAPI route), run one command, and every call site that no
longer matches the contract becomes a compile error.

For _how_ auth works (tokens, the gateway), see
[`AUTHENTICATION.md`](AUTHENTICATION.md). This guide is about the contract.

---

## Mental model (30 seconds)

```
Spring / FastAPI / Better Auth code  ──►  openapi/<service>.json  ──►  generated/<service>.ts  ──►  apiClient.GET('/api/...')
          (source of truth)               (committed spec)             (committed, generated       (compile-checked URL,
                                                                        paths/components types)     params, body, response)
```

- Specs are generated **at build time, from the code — no running containers**:
  - **Spring services**: the springdoc Gradle plugin (`./gradlew generateOpenApiDocs`)
    boots each service against embedded H2 on a side port, fetches its spec and
    tears down.
  - **genai-service**: FastAPI builds the schema in-memory
    (`nx run genai-service:export-openapi`).
  - **auth-service**: Better Auth's `openAPI` plugin, extracted in-process.
- [`scripts/generate-openapi.ts`](../../scripts/generate-openapi.ts) canonicalises
  every spec (sorted keys, deterministic output) and runs
  [`openapi-typescript`](https://openapi-ts.dev/) to emit the typed modules.
- Both the specs (`openapi/`) and the generated modules
  (`apps/client/src/shared/api/generated/`) are **committed**, so reviewers see
  the contract change in the diff — and **CI fails the PR if they're stale**
  (the `openapi-drift` job in `testing.yml` regenerates everything and diffs).

---

## Regenerating after an API change

No stack needed — don't start anything:

```sh
bun run openapi   # spring + FastAPI + auth spec gen, then the typed client
```

Commit the regenerated `openapi/*.json` and `generated/*.ts` alongside your code
change. If you forget, the `openapi-drift` CI job fails with exactly that
instruction; the TypeScript compiler then points at every call site the change
breaks.

The same applies to dependency bumps (e.g. from Renovate): upgrading a
generator — springdoc, FastAPI, Better Auth, `openapi-typescript` — can change
the emitted output, and the drift job will flag it. The fix is always the same
`bun run openapi` + commit.

---

## Calling the APIs from the client

All services are served behind one gateway, so there is **one client** —
[`apps/client/src/shared/api/client.ts`](../../apps/client/src/shared/api/client.ts)
merges every service's generated `paths` type and wires the Better Auth JWT
once, in a request middleware:

```ts
import { apiClient } from '@/shared/api/client';

const { data, error } = await apiClient.GET('/api/budgets/categories');
await apiClient.DELETE('/api/budgets/categories/{id}', { params: { path: { id } } });
```

[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) checks every call
against the spec at compile time:

| Change in spec                | Effect on callers                                 |
| ----------------------------- | ------------------------------------------------- |
| Endpoint path renamed/deleted | TS error: the path is no longer a valid key       |
| Required body field added     | TS error: `body` missing property                 |
| Response shape changed        | TS error: callers destructuring the removed field |
| Wrong HTTP method used        | TS error: no `.POST` on a GET-only path           |

Feature code keeps its thin wrapper modules (e.g.
[`budgetApi.ts`](../../apps/client/src/features/budgets/api/budgetApi.ts)):
they call `apiClient`, funnel failures through `unwrap` → `ApiError`
(`@/shared/lib/api`, so hooks can branch on the backend's error contract), and
re-export ergonomic response types:

```ts
import type { components } from '@/shared/api/generated/budget-service';

// Response fields are typed optional in the spec (no @NonNull on the record),
// but the server always sends them, so re-require for ergonomic consumers.
export type Category = Required<components['schemas']['CategoryResponse']>;
```

---

## Browsing the APIs (one Swagger UI)

With the stack up, a **single** Swagger UI behind the gateway shows every
service's API, with a dropdown to switch between them:

**http://localhost:9099/docs/**

There are intentionally no per-service Swagger UIs — the Spring services use
springdoc's `-api` starter (spec only, no UI webjar), FastAPI's `/docs` is
disabled, and Better Auth's reference page is off. Each service still serves
its raw spec at runtime for the aggregated UI:

| Service              | Raw spec (via gateway, same origin) |
| -------------------- | ----------------------------------- |
| budget-service       | `/api/budgets/v3/api-docs`          |
| transaction-service  | `/api/transactions/v3/api-docs`     |
| notification-service | `/api/notifications/v3/api-docs`    |
| genai-service        | `/api/genai/openapi.json`           |

Use the **Authorize** button (scheme `bearerAuth`) to paste a JWT and try secured
endpoints — get a token per [`AUTHENTICATION.md`](AUTHENTICATION.md).

---

## How it's wired

- **Spring:** the `springdoc-openapi-starter-webmvc-api` dependency is declared
  once in [`commons-jvm`](../../apps/commons-jvm/build.gradle.kts); a shared
  `OpenApiConfig` adds the `bearerAuth` JWT security scheme. Each service's
  `build.gradle.kts` configures the `org.springdoc.openapi-gradle-plugin`
  (`openApi { ... }` block): `generateOpenApiDocs` forks the app with embedded
  H2 (`developmentOnly("com.h2database:h2")` — never in the jar) on a side port
  (`1808x`, so a running dev stack doesn't collide) and writes
  `openapi/<service>.json`.
- **FastAPI:** [`apps/genai-service/scripts/export_openapi.py`](../../apps/genai-service/scripts/export_openapi.py)
  dumps `app.openapi()` — invoked via the `export-openapi` Nx target.
- **Better Auth:** the `openAPI` plugin in
  [`auth.ts`](../../apps/auth-service/src/auth.ts) exposes
  `auth.api.generateOpenAPISchema()`; `scripts/generate-openapi.ts` extracts it
  in-process and re-roots the paths under `/api/auth`.
- **Codegen + drift check:** [`scripts/generate-openapi.ts`](../../scripts/generate-openapi.ts)
  canonicalises all specs and emits the generated modules; the `openapi-drift`
  job in [`testing.yml`](../../.github/workflows/testing.yml) reruns the whole
  pipeline and fails on any uncommitted difference.
- **Aggregated UI:** the `swagger-ui` container in
  [`docker-compose.yaml`](../../docker-compose.yaml) is configured with every
  service's spec URL and proxied by the gateway at `/docs` (see the `handle /docs*`
  block in [`Caddyfile`](../../Caddyfile)).

Adding a service? Spring: copy the `openApi { ... }` block into its
`build.gradle.kts`. Anything else: write its spec into `openapi/` from
`scripts/generate-openapi.ts`. Either way, add the service name to the
`services` list in that script, then merge its generated `paths` type into
`ApiPaths` in `apps/client/src/shared/api/client.ts`.
