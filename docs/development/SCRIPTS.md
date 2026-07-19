# Scripts

## `scripts/generate-openapi.ts`

Regenerates the committed OpenAPI specs (`openapi/*.json`) and the typed frontend client (`apps/client/src/shared/api/generated/*.ts`) from the code — no running containers.

**Usage:**

```sh
bun run openapi   # the whole pipeline, one command
```

**What it does:**

1. Runs `./gradlew generateOpenApiDocs` — the springdoc plugin boots each Spring service against embedded H2 and writes its spec (a no-op when nothing changed)
2. Runs `nx run genai-service:export-openapi` (FastAPI builds its schema in-memory)
3. Extracts the auth-service spec in-process via Better Auth's `openAPI` plugin, re-rooting paths under `/api/auth`
4. Canonicalises every spec in `openapi/` (recursively sorted keys, no `servers` block, 2-space indent) so output is byte-identical across machines — the CI drift check depends on this
5. Runs `openapi-typescript` over each spec to emit the typed client modules

The `openapi-drift` job in [`ci.yml`](../../.github/workflows/ci.yml) runs the same `bun run openapi` on every PR and fails on any uncommitted difference. See [API_CLIENTS.md](API_CLIENTS.md) for the full picture.

**Prerequisites:**

None beyond the repo toolchain (Bun, JDK 21 via the Gradle wrapper, uv).

## `scripts/deploy/main.ts`

Deploys ExpenseFlow to any Kubernetes environment. Defaults to the latest git tag on `t99-stage`.

**Usage:**

```sh
bun deploy:k8s                                     # latest tag → t99-stage
bun deploy:k8s --env prod                          # latest tag → t99-prod (values.prod.yaml)
bun deploy:k8s --env prod --namespace t99-staging  # prod values file, custom namespace
bun deploy:k8s --version 1.2.3                     # explicit version override
bun deploy:k8s --dry-run                           # validate without applying
```

`--env` and `--namespace` are independent: `--env` picks the values file; `--namespace` sets the k8s namespace (defaults to `t99-<env>`).

**What it does:**

1. Resolves the image version from `--version` or the latest git tag
2. For every input declared in `scripts/deploy/inputs.ts`, resolves a value in order:
   - CLI flag (e.g. `--llm-api-key`, `--studio-github-client-id`)
   - `.env` file at the repo root
   - Existing cluster secret (via `kubectl get secret`)
   - Interactive prompt (TTY only)
3. Optional feature inputs (e.g. GitHub OAuth credentials for protected tools) that remain unresolved disable the feature — silently in CI, with a yes/no confirm in an interactive terminal
4. Writes all resolved values to a short-lived temp file passed to Helm via `-f`; nothing sensitive appears on the process list
5. Runs `helm upgrade --install` with `values.yaml`, the env values file, and the temp values
6. Waits up to 10 minutes for the rollout; rolls back on failure and surfaces stderr

**Adding a new secret or optional feature:**

Add one entry to `scripts/deploy/inputs.ts`. No changes to `main.ts` are needed.

**Prerequisites:**

- `kubectl` configured with access to the target cluster/namespace
- `helm` installed
- At least one git tag (e.g. `git tag v0.3.1`), or pass `--version` explicitly

**Inputs resolved at deploy time:**

| Env var                      | Required | Feature gate                                           |
| ---------------------------- | -------- | ------------------------------------------------------ |
| `LLM_API_KEY`                | Yes      | —                                                      |
| `DEMO_USER_PASSWORD`         | No       | — (account locked with random password if unset)       |
| `RESEND_API_KEY`             | No       | — (Alertmanager email notifications disabled if unset) |
| `GITHUB_OAUTH_CLIENT_ID`     | No       | OAuth-protected tools (Drizzle Studio, Grafana)        |
| `GITHUB_OAUTH_CLIENT_SECRET` | No       | OAuth-protected tools (Drizzle Studio, Grafana)        |
