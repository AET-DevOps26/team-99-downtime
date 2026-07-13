# Kubernetes Deployment

ExpenseFlow is a microservices monorepo (6 services + PostgreSQL) deployed to a shared university Kubernetes cluster (Rancher + nginx ingress + cert-manager). Stage deploys automatically on every merge to `main`; production is promoted manually via a GitHub Actions workflow dispatch.

**Cluster namespace limits:**

- `t99-stage`: 2500 MiB RAM / 2000m CPU
- `t99-prod`: 3500 MiB RAM / 2000m CPU

## Tool Choices

- **Helm** — single umbrella chart with per-env values files
- **GitHub Actions** — direct `helm upgrade --install` from the pipeline, no GitOps controller
- **oauth2-proxy** — GitHub OAuth gate for Drizzle Studio (repo-collaborator access)
- **Bun TypeScript scripts** — local deploys via `scripts/deploy/main.ts`

## Repository Layout

```
k8s/
  helm/
    t99-app/
      Chart.yaml
      values.yaml             # Shared defaults
      values.stage.yaml       # Stage overrides (domain, drizzleStudio.enabled)
      values.prod.yaml        # Prod overrides
      templates/
        _helpers.tpl
        secrets.yaml          # DB password, JWT key, OAuth cookie — generated once via lookup
        ingress.yaml
        auth/                 # deployment + service + configmap
        client/               # deployment + service
        transaction/          # deployment + service + configmap
        notification/         # deployment + service + configmap
        budget/               # deployment + service + configmap
        genai/                # deployment + service + configmap
        postgresql/           # statefulset + service
        studio/               # drizzle-gateway + oauth2-proxy + PVC + configmap + ingress
```

## CI/CD Pipeline

```
[cd.yml — on push to main]
  1. Build & publish affected Docker images to GHCR
     Tags: ghcr.io/aet-devops26/team-99-downtime/t99-{service}:{semver} + :latest
  2. Cut versioned release via nx release (conventional commits gate)
  3. Attest build provenance (GitHub Attestations)
  4. helm upgrade --install t99 → t99-stage (automatic)

[deploy-prod.yml — manual workflow_dispatch]
  Input: version tag (e.g. 0.3.1)
  → helm upgrade --install t99 → t99-prod
```

All Helm invocations use `--wait --timeout 10m --rollback-on-failure`.

## Local Deploy

```sh
bun deploy:k8s                                     # latest tag → t99-stage
bun deploy:k8s --env prod                          # latest tag → t99-prod (values.prod.yaml)
bun deploy:k8s --env prod --namespace t99-staging  # prod values file, custom namespace
bun deploy:k8s --version 1.2.3                     # pin an explicit version
bun deploy:k8s --dry-run                           # validate without applying
```

`--env` selects the values file; `--namespace` overrides the k8s namespace independently (defaults to `t99-<env>`).

The script resolves each required input in order — CLI flag → `.env` → existing cluster secret → interactive prompt. Credentials already stored in the cluster are reused silently. In a non-interactive environment (CI) any unresolved optional input disables the corresponding feature; required inputs cause a hard exit with a clear message.

To bypass a prompt non-interactively, pass the value as a flag or set it in `.env`:

```sh
# All inputs can be overridden via flag:
bun deploy:k8s --llm-api-key=sk-... --studio-github-client-id=... --studio-github-client-secret=...
```

See [SCRIPTS.md](../development/SCRIPTS.md#scriptsdeploy) for the full input reference.

## Ingress

Nginx ingress controller, cert-manager `letsencrypt-prod` ClusterIssuer for TLS.

| Path prefix           | Backend service      | Port |
| --------------------- | -------------------- | ---- |
| `/api/auth/`          | auth-service         | 3000 |
| `/api/transactions/`  | transaction-service  | 8080 |
| `/api/budgets/`       | budget-service       | 8082 |
| `/api/notifications/` | notification-service | 8081 |
| `/api/genai/`         | genai-service        | 8000 |
| `/`                   | client (SPA)         | 80   |

Domains:

- Stage: `stage.t99.stud.k8s.aet.cit.tum.de`
- Prod: `t99.stud.k8s.aet.cit.tum.de`

## Drizzle Studio

Live database inspector deployed per environment when `drizzleStudio.enabled: true`.

- **Image:** `ghcr.io/drizzle-team/gateway:latest`
- **Auth:** `oauth2-proxy` in front by default (`drizzleStudio.oauth.enabled: true`) — GitHub OAuth scoped to collaborators of `aet-devops26/team-99-downtime`; set `oauth.enabled: false` (or use `--no-oauth`) to expose studio directly without authentication
- **DB connections:** `auth_db`, `transaction_db`, `budget_db`, `notification_db` pre-configured via `store.json` ConfigMap; init container substitutes `__DB_PASSWORD__` at pod start
- **Config persistence:** 128 Mi RWO PVC (`helm.sh/resource-policy: keep`); deployment strategy `Recreate`

| Environment | Studio URL                                         |
| ----------- | -------------------------------------------------- |
| Stage       | `https://studio.stage.t99.stud.k8s.aet.cit.tum.de` |
| Prod        | `https://studio.t99.stud.k8s.aet.cit.tum.de`       |

## Resource Allocation

Namespace capacity: **t99-stage** 2500 MiB / 2000m CPU · **t99-prod** 3500 MiB / 2000m CPU

| Service              | RAM request → limit   | CPU request → limit |
| -------------------- | --------------------- | ------------------- |
| postgresql           | 128 Mi → 256 Mi       | 100m → 200m         |
| auth-service         | 64 Mi → 128 Mi        | 50m → 100m          |
| client               | 32 Mi → 64 Mi         | 10m → 50m           |
| transaction-service  | 192 Mi → 384 Mi       | 100m → 300m         |
| notification-service | 192 Mi → 384 Mi       | 100m → 300m         |
| budget-service       | 192 Mi → 384 Mi       | 100m → 300m         |
| genai-service        | 128 Mi → 256 Mi       | 50m → 150m          |
| drizzle-studio       | 64 Mi → 128 Mi        | 10m → 100m          |
| oauth2-proxy         | 32 Mi → 64 Mi         | 10m → 50m           |
| **Total**            | **1024 Mi → 2048 Mi** | **530m → 1550m**    |

**prod only:** PostgreSQL limits raised to 256 Mi → 512 Mi (via `values.prod.yaml`).

All Spring Boot services get `JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=75.0 -XX:+UseContainerSupport"`.

## Demo Account

A demo user is seeded automatically on every fresh deploy. No manual steps required.

| Field    | Value                                                                            |
| -------- | -------------------------------------------------------------------------------- |
| Email    | `demo@expenseflow.dev`                                                           |
| Password | set via `demoUserPassword` in `t99-app-secrets`; random locked password if unset |

Pre-loaded data: 6 budget categories (Groceries, Transport, Dining, Entertainment, Utilities, Health) and 35 transactions across the 3 months prior to the deploy date.

### How seeding works

- **auth-service**: the Helm pre-install/pre-upgrade Job (`auth-migrate`) extends `migrate.ts` to create the demo user via Better Auth and pins its ID to the fixed UUID `00000000-0000-0000-0000-000000000099`.
- **budget-service / transaction-service**: Flyway migration `V2__seed_demo_data.sql` runs on startup and inserts seed data referencing that fixed UUID. `ON CONFLICT DO NOTHING` keeps re-runs safe.

### Resetting the demo account

Delete the relevant rows and re-deploy (or re-trigger the migrate Job manually):

```sh
# Remove demo user from auth
kubectl exec -n <namespace> statefulset/t99-postgresql -- \
  psql -U postgres -d auth_db \
  -c "DELETE FROM \"user\" WHERE email = 'demo@expenseflow.dev';"

# Remove seed data from other services (Flyway re-inserts on next startup)
kubectl exec -n <namespace> statefulset/t99-postgresql -- \
  psql -U postgres -d budget_db \
  -c "DELETE FROM flyway_schema_history WHERE version = '2'; DELETE FROM categories WHERE user_id = '00000000-0000-0000-0000-000000000099';"

kubectl exec -n <namespace> statefulset/t99-postgresql -- \
  psql -U postgres -d transaction_db \
  -c "DELETE FROM flyway_schema_history WHERE version = '2'; DELETE FROM transactions WHERE user_id = '00000000-0000-0000-0000-000000000099';"
```

Then re-trigger the migrations and restart the affected services:

```sh
helm upgrade t99 k8s/helm/t99-app/ ...

# Force budget and transaction pods to restart so Flyway V2 re-runs
kubectl rollout restart -n <namespace> \
  deployment/t99-budget-service \
  deployment/t99-transaction-service
kubectl rollout status -n <namespace> \
  deployment/t99-budget-service \
  deployment/t99-transaction-service
```

## Secrets Management

Secrets are generated by the Helm chart using the `lookup` pattern — stable across upgrades, never regenerated:

| Secret               | Key                         | Generated by                                    |
| -------------------- | --------------------------- | ----------------------------------------------- |
| `t99-db-credentials` | `password`                  | `randAlphaNum 32` on first install              |
| `t99-app-secrets`    | `jwtSigningKey`             | `randAlphaNum 64` on first install              |
| `t99-studio-oauth2`  | `cookieSecret`              | `randAlphaNum 32` on first install              |
| `t99-studio-oauth2`  | `clientId` / `clientSecret` | Passed via `--set` (CI secrets or local prompt) |

All secrets carry `helm.sh/resource-policy: keep` — they survive `helm uninstall`.

Required GitHub Actions secrets:

| Secret                             | Used by                                      |
| ---------------------------------- | -------------------------------------------- |
| `KUBECONFIG_DATA`                  | base64-encoded kubeconfig for cluster access |
| `STUDIO_GITHUB_CLIENT_ID`          | Stage OAuth App client ID                    |
| `STUDIO_GITHUB_CLIENT_SECRET`      | Stage OAuth App client secret                |
| `STUDIO_GITHUB_CLIENT_ID_PROD`     | Prod OAuth App client ID                     |
| `STUDIO_GITHUB_CLIENT_SECRET_PROD` | Prod OAuth App client secret                 |

## Bootstrap (First-Time Setup)

1. Ensure `kubectl` context is set to the cluster
2. Create namespaces: `kubectl create namespace t99-stage t99-prod`
3. Base64-encode the kubeconfig and add it as `KUBECONFIG_DATA` in GitHub Actions secrets
4. Create two GitHub OAuth Apps (one for stage, one for prod) with callback URLs:
   - Stage: `https://studio.stage.t99.stud.k8s.aet.cit.tum.de/oauth2/callback`
   - Prod: `https://studio.t99.stud.k8s.aet.cit.tum.de/oauth2/callback`
5. Add the four `STUDIO_GITHUB_*` secrets to GitHub Actions
6. Push to `main` — the CD pipeline handles the rest

For local deploys: `bun deploy:k8s` (prompts for OAuth credentials on first run).
