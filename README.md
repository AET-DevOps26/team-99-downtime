# ⚡ ExpenseFlow `v1.0` `by 99 Downtime`

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/AET-DevOps26/team-99-downtime?style=for-the-badge) ![GitHub branch check runs](https://img.shields.io/github/check-runs/AET-DevOps26/team-99-downtime/main?style=for-the-badge)

Personal finance app — track expenses, manage budgets, and get spending alerts.

## Quick Start

```sh
cp .env.example .env          # fill in BETTER_AUTH_SECRET + Google OAuth creds
docker compose up -d --build
```

Open **http://localhost:9099**. See [Development Setup](docs/development/SETUP.md) for the full guide (native Nx mode, endpoints, per-service instructions).

## Live Environments

| Environment | App                                       | Studio                                           |
| ----------- | ----------------------------------------- | ------------------------------------------------ |
| Stage       | https://stage.t99.stud.k8s.aet.cit.tum.de | https://studio.stage.t99.stud.k8s.aet.cit.tum.de |
| Prod        | https://t99.stud.k8s.aet.cit.tum.de       | https://studio.t99.stud.k8s.aet.cit.tum.de       |

## Deployment

Every push to `main` is automatically deployed to **stage**. Promote to **prod** via the _Deploy to Production_ workflow dispatch in GitHub Actions. For manual deploys: `bun deploy:k8s`. See [Kubernetes Deployment](docs/deployment/KUBERNETES.md).

## Docs

| Topic                       | Link                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| Development setup           | [docs/development/SETUP.md](docs/development/SETUP.md)                         |
| Architecture & services     | [docs/architecture/SERVICE_OVERVIEW.md](docs/architecture/SERVICE_OVERVIEW.md) |
| Auth dev guide              | [docs/development/AUTHENTICATION.md](docs/development/AUTHENTICATION.md)       |
| OpenAPI & generated clients | [docs/development/API_CLIENTS.md](docs/development/API_CLIENTS.md)             |
| Kubernetes deployment       | [docs/deployment/KUBERNETES.md](docs/deployment/KUBERNETES.md)                 |
| VM / Terraform deployment   | [docs/deployment/TERRAFORM.md](docs/deployment/TERRAFORM.md)                   |
| Scripts reference           | [docs/development/SCRIPTS.md](docs/development/SCRIPTS.md)                     |
| Problem statement           | [docs/problem/PROBLEM_STATEMENT.md](docs/problem/PROBLEM_STATEMENT.md)         |
