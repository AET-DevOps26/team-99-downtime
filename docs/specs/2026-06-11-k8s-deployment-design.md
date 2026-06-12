# Kubernetes Deployment Design

**Date:** 2026-06-11
**Status:** Approved

## Context

ExpenseFlow is a microservices monorepo (6 services + PostgreSQL) currently running locally via Docker Compose. The team needs a production-grade deployment to a shared university Kubernetes cluster (Rancher + cert-manager already installed). The goal is automated stage deployments on every merge to `main`, with manual promotion to production via a visual pipeline (Kargo).

Constraints:

- `t99-argo-cd`: 1 GB RAM / 0.5 CPU
- `t99-kargo`: 0.5 GB RAM / 0.5 CPU
- `t99-stage`: 2 GB RAM / 1.5 CPU
- `t99-prod`: 2.5 GB RAM / 1.5 CPU

## Architecture

### Tool Choices

- **Helm** for Kubernetes manifests (single umbrella chart, per-env values files). First-class ArgoCD + Kargo support, no build step.
- **ArgoCD** for GitOps sync (watches `k8s/` in this repo, applies changes on commit).
- **Kargo** for promotion pipeline (Warehouse detects new images, auto-promotes to stage, manual promote to prod).
- **Bun TypeScript scripts** for one-time bootstrap.

### Repository Layout

```
k8s/
  bootstrap/
    argocd-values.yaml        # Helm overrides for ArgoCD (resource limits)
    kargo-values.yaml         # Helm overrides for Kargo (resource limits)
  argocd/
    root-app.yaml             # App of Apps — ArgoCD watches k8s/argocd/
    app-stage.yaml            # ArgoCD Application: t99-stage
    app-prod.yaml             # ArgoCD Application: t99-prod
  kargo/
    project.yaml              # Kargo Project "t99"
    warehouse.yaml            # Warehouse: subscribes to 6 GHCR image repos (v* tags)
    stage-stage.yaml          # Stage t99-stage (auto-promote)
    stage-prod.yaml           # Stage t99-prod (manual approval)
  helm/
    t99-app/
      Chart.yaml
      values.yaml             # Shared defaults
      values.stage.yaml       # Stage: domain, image tags, resource limits
      values.prod.yaml        # Prod: domain, image tags, resource limits
      templates/
        _helpers.tpl
        auth/deployment.yaml
        auth/service.yaml
        auth/configmap.yaml
        client/deployment.yaml
        client/service.yaml
        transaction/deployment.yaml
        transaction/service.yaml
        transaction/configmap.yaml
        notification/deployment.yaml
        notification/service.yaml
        notification/configmap.yaml
        budget/deployment.yaml
        budget/service.yaml
        budget/configmap.yaml
        genai/deployment.yaml
        genai/service.yaml
        genai/configmap.yaml
        postgresql/statefulset.yaml
        postgresql/service.yaml
        ingress.yaml

scripts/
  bootstrap-k8s.ts            # One-command install: ArgoCD + Kargo + root App
  create-secrets.ts           # Generate + apply k8s Secrets; print values to stdout
```

### Promotion Pipeline

```
[cd.yml — on push to main]
  1. Build and push Docker images to GHCR (existing)
     Tags: ghcr.io/aet-devops26/team-99-downtime/t99-{service}:v{semver}
  2. NEW: kargo refresh warehouse "t99-app-warehouse"

[Kargo Warehouse: t99-app-warehouse]
  → Polls all 6 GHCR image repos for new v* tags
  → Creates Freight(images=[v1.2.3,...])

[Kargo Stage: t99-stage]  ← auto-promote
  → Updates image tags in k8s/helm/t99-app/values.stage.yaml
  → Commits + pushes to main
  → ArgoCD detects commit → syncs t99-stage namespace

[Kargo Stage: t99-prod]  ← manual
  → "Promote" in Kargo UI
  → Updates k8s/helm/t99-app/values.prod.yaml
  → ArgoCD syncs t99-prod namespace
```

### Ingress (replaces Caddy)

Nginx ingress controller (Rancher default), cert-manager `letsencrypt-prod` ClusterIssuer for TLS.

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

### Resource Allocation

**t99-stage (2 GB / 1.5 CPU):**

| Service              | RAM request → limit  | CPU request → limit |
| -------------------- | -------------------- | ------------------- |
| postgresql           | 128 Mi → 256 Mi      | 100m → 200m         |
| auth-service         | 64 Mi → 128 Mi       | 50m → 100m          |
| client               | 32 Mi → 64 Mi        | 10m → 50m           |
| transaction-service  | 192 Mi → 384 Mi      | 100m → 300m         |
| notification-service | 192 Mi → 384 Mi      | 100m → 300m         |
| budget-service       | 192 Mi → 384 Mi      | 100m → 300m         |
| genai-service        | 128 Mi → 256 Mi      | 50m → 150m          |
| **Total**            | **928 Mi → 1856 Mi** | **510m → 1400m**    |

**t99-prod (2.5 GB / 1.5 CPU):** Same requests; wider limits. PostgreSQL: 256 Mi → 512 Mi.

All Spring Boot services get `JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=75.0 -XX:+UseContainerSupport"`.

### ArgoCD Installation (t99-argo-cd, 1 GB / 0.5 CPU)

`k8s/bootstrap/argocd-values.yaml` overrides:

- All components: 1 replica
- Disable HA, metrics, notifications server, ApplicationSet controller (not needed)
- Resource limits set per component to stay under 1 GB / 0.5 CPU total

### Kargo Installation (t99-kargo, 0.5 GB / 0.5 CPU)

`k8s/bootstrap/kargo-values.yaml` overrides:

- Minimal deployment: API server + controller + garbage collector
- Total target: ~320 Mi / 0.25 CPU

### Secrets Management

All secrets are pre-created before first ArgoCD sync. The Helm chart references them by name — it does not create them.

Required secrets (per namespace: t99-stage and t99-prod):

- `t99-ghcr-pull` — Docker pull secret for `ghcr.io` (GHCR token prompted interactively at bootstrap time)
- `t99-db-credentials` — PostgreSQL password (auto-generated)
- `t99-app-secrets` — JWT signing key (auto-generated)

`scripts/create-secrets.ts` auto-generates passwords, prompts the user to paste their GHCR token interactively (no env var required), applies all secrets to both namespaces via `kubectl`, and prints all generated values to stdout.

### Bootstrap Procedure

1. Ensure `kubectl` context is set to the cluster
2. Run: `bun run scripts/bootstrap-k8s.ts` — installs ArgoCD + Kargo + root App of Apps, then automatically invokes `create-secrets.ts` (which prompts for the GHCR token interactively)
3. Add `KARGO_API_TOKEN` (from Kargo UI → Service Accounts) as a GitHub Actions secret named `KARGO_API_TOKEN`
4. Add `KARGO_SERVER=https://kargo.t99.stud.k8s.aet.cit.tum.de` as a GitHub Actions variable
5. From this point, all subsequent config changes are applied automatically via ArgoCD

### cd.yml Changes

The existing `deploy` job stub is replaced with:

```yaml
- name: Trigger Kargo warehouse refresh
  env:
    KARGO_SERVER: ${{ vars.KARGO_SERVER }}
    KARGO_TOKEN: ${{ secrets.KARGO_API_TOKEN }}
  run: |
    # Install kargo CLI, authenticate, refresh warehouse
    kargo login $KARGO_SERVER --token $KARGO_TOKEN
    kargo refresh warehouse t99-app-warehouse --project t99 --wait
```

## Verification

1. Run `bun run scripts/bootstrap-k8s.ts` — ArgoCD and Kargo pods become Ready
2. Run `bun run scripts/create-secrets.ts` — secrets visible in both namespaces
3. Push a commit to `main` — CD workflow completes, Kargo warehouse refresh triggers
4. Kargo UI shows a new Freight and active promotion to t99-stage
5. ArgoCD UI shows t99-stage synced and healthy
6. `https://stage.t99.stud.k8s.aet.cit.tum.de` serves the app
7. In Kargo UI, promote Freight to t99-prod → t99-prod syncs → prod domain serves the app
