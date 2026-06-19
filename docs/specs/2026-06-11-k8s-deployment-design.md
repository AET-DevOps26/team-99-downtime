# Kubernetes Deployment Design

**Date:** 2026-06-11
**Updated:** 2026-06-15
**Status:** Implemented

## Context

ExpenseFlow is a microservices monorepo (6 services + PostgreSQL) deployed to a shared university Kubernetes cluster (Rancher + nginx ingress + cert-manager). Stage is deployed automatically on every merge to `main`; production is promoted manually via a GitHub Actions workflow dispatch.

Constraints:

- `t99-stage`: 2 GB RAM / 1.5 CPU
- `t99-prod`: 2.5 GB RAM / 1.5 CPU

## Architecture

### Tool Choices

- **Helm** for Kubernetes manifests (single umbrella chart, per-env values files).
- **GitHub Actions** for CI/CD — direct `helm upgrade --install` from the pipeline, no GitOps controller needed.
- **oauth2-proxy** for Drizzle Studio authentication (GitHub OAuth, repo-collaborator gate).
- **Bun TypeScript scripts** for local deploys (`scripts/deploy-stage.ts`).

### Repository Layout

```
k8s/
  helm/
    t99-app/
      Chart.yaml
      values.yaml             # Shared defaults
      values.stage.yaml       # Stage overrides (domain, drizzleStudio.enabled)
      values.prod.yaml        # Prod overrides (domain, drizzleStudio.enabled)
      templates/
        _helpers.tpl
        secrets.yaml          # DB password, JWT key, OAuth cookie — generate-once via lookup
        ingress.yaml
        auth/deployment.yaml + service.yaml + configmap.yaml
        client/deployment.yaml + service.yaml
        transaction/deployment.yaml + service.yaml + configmap.yaml
        notification/deployment.yaml + service.yaml + configmap.yaml
        budget/deployment.yaml + service.yaml + configmap.yaml
        genai/deployment.yaml + service.yaml + configmap.yaml
        postgresql/statefulset.yaml + service.yaml
        studio/deployment.yaml      # drizzle-gateway (Recreate strategy, RWO PVC)
        studio/service.yaml
        studio/configmap.yaml       # store.json with __DB_PASSWORD__ placeholder
        studio/pvc.yaml             # 128 Mi, helm.sh/resource-policy: keep
        studio/oauth2-proxy.yaml    # GitHub OAuth gate
        studio/ingress.yaml

scripts/
  deploy-stage.ts             # Local deploy: reads secrets from cluster or prompts
  bootstrap-argocd-kargo.ts   # Optional: ArgoCD + Kargo alternative (commented out in cd.yml)

infra/
  drizzle-studio/
    store.json                # Pre-configured connections for local Docker Compose
```

### CI/CD Pipeline

```
[cd.yml — on push to main]
  1. Build & publish affected Docker images to GHCR
     Tags: ghcr.io/aet-devops26/team-99-downtime/t99-{service}:{semver} + :latest
  2. Cut versioned release via nx release (conventional commits gate)
  3. Attest build provenance (GitHub Attestations)
  4. helm upgrade --install t99 → t99-stage (auto)

[deploy-prod.yml — manual workflow_dispatch]
  Input: version tag (e.g. 0.3.1)
  → helm upgrade --install t99 → t99-prod
```

All Helm invocations use `--wait --timeout 5m --rollback-on-failure`.

### Local Deploy

```sh
bun deploy:k8s                    # → t99-stage (latest git tag)
bun deploy:k8s -n t99-prod        # → any namespace
```

Reads GitHub OAuth credentials from the existing cluster secret if present; prompts on first run.

### Ingress

Nginx ingress controller, cert-manager `letsencrypt-prod` ClusterIssuer for TLS.

| Path prefix       | Backend service      | Port |
| ----------------- | -------------------- | ---- |
| `/`               | client               | 80   |
| `/api/auth/`      | auth-service         | 3000 |
| `/transactions/`  | transaction-service  | 8080 |
| `/budgets/`       | budget-service       | 8082 |
| `/notifications/` | notification-service | 8081 |
| `/genai/`         | genai-service        | 8000 |

Domains:

- Stage: `stage.t99.stud.k8s.aet.cit.tum.de`
- Prod: `t99.stud.k8s.aet.cit.tum.de`

### Drizzle Studio

Live database inspector deployed per environment when `drizzleStudio.enabled: true`.

- **Image:** `ghcr.io/drizzle-team/gateway:latest`
- **Auth:** `oauth2-proxy` (quay.io/oauth2-proxy/oauth2-proxy:v7.7.1) in front of the gateway — GitHub OAuth, scoped to collaborators of `aet-devops26/team-99-downtime` (`read:org` scope required for session creation)
- **DB connections:** `auth_db`, `transaction_db`, `budget_db` pre-configured via `store.json` ConfigMap; init container substitutes `__DB_PASSWORD__` at pod start
- **Config persistence:** 128 Mi RWO PVC (`helm.sh/resource-policy: keep`); deployment strategy `Recreate` to avoid mount conflicts
- **Separate OAuth Apps:** stage and prod use different GitHub OAuth Apps (different callback URLs)

| Environment | Studio URL                                       |
| ----------- | ------------------------------------------------ |
| Stage       | https://studio.stage.t99.stud.k8s.aet.cit.tum.de |
| Prod        | https://studio.t99.stud.k8s.aet.cit.tum.de       |

### Resource Allocation

**t99-stage (2 GB / 1.5 CPU):**

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
| **Total**            | **1026 Mi → 2048 Mi** | **590m → 1550m**    |

**t99-prod (2.5 GB / 1.5 CPU):** Same requests; wider limits. PostgreSQL: 256 Mi → 512 Mi.

All Spring Boot services get `JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=75.0 -XX:+UseContainerSupport"`.

### Secrets Management

Secrets are generated by the Helm chart itself using the `lookup` pattern — stable across upgrades, never regenerated:

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

### Bootstrap Procedure

1. Ensure `kubectl` context is set to the cluster
2. Create the namespaces: `kubectl create namespace t99-stage t99-prod`
3. Base64-encode the kubeconfig and add it as `KUBECONFIG_DATA` in GitHub Actions secrets
4. Create two GitHub OAuth Apps (one for stage, one for prod) with callback URLs:
   - Stage: `https://studio.stage.t99.stud.k8s.aet.cit.tum.de/oauth2/callback`
   - Prod: `https://studio.t99.stud.k8s.aet.cit.tum.de/oauth2/callback`
5. Add the four `STUDIO_GITHUB_*` secrets to GitHub Actions
6. Push to `main` — the CD pipeline handles the rest

For local/manual deploys: `bun deploy:k8s` (prompts for OAuth credentials on first run, then reads from cluster secret).

## Verification

1. Push a commit to `main` with a releasable conventional commit — CD workflow builds, releases, and deploys to stage
2. `https://stage.t99.stud.k8s.aet.cit.tum.de` serves the app
3. `https://studio.stage.t99.stud.k8s.aet.cit.tum.de` requires GitHub login (collaborators of `aet-devops26/team-99-downtime` only)
4. All three databases visible and queryable in Drizzle Studio
5. Trigger **Deploy to Production** workflow with a version tag → prod domain serves the app
