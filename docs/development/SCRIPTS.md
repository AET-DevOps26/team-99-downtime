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

The `openapi-drift` job in `testing.yml` runs the same `bun run openapi` on every PR and fails on any uncommitted difference. See [API_CLIENTS.md](API_CLIENTS.md) for the full picture.

**Prerequisites:**

None beyond the repo toolchain (Bun, JDK 21 via the Gradle wrapper, uv).

## `scripts/deploy-stage.ts`

Deploys the latest Helm release to a Kubernetes namespace (defaults to `t99-stage`).

**Usage:**

```sh
bun deploy:k8s                # deploy to t99-stage
bun deploy:k8s -n t99-prod   # deploy to a different namespace
```

**What it does:**

1. Reads the latest git tag as the image version (fails if no tags exist)
2. Looks up the `t99-studio-oauth2` secret in the target namespace for GitHub OAuth credentials; prompts interactively if the secret is absent
3. Runs `helm upgrade --install` with `values.yaml` + `values.stage.yaml`, setting all service image tags to the resolved version and passing the OAuth credentials via `--set`
4. Waits up to 5 minutes for the rollout; rolls back on failure

**Prerequisites:**

- `kubectl` configured with access to the target cluster/namespace
- `helm` installed
- A git tag on the current commit (e.g. `git tag v0.3.1`)
- On first run: GitHub OAuth App client ID and secret for Drizzle Studio (see [KUBERNETES.md](../deployment/KUBERNETES.md#drizzle-studio))

**Required env / secrets:**

None — credentials are read from the cluster secret or prompted interactively.
