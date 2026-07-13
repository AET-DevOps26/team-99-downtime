# ⚡ ExpenseFlow `by 99 Downtime`

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/AET-DevOps26/team-99-downtime?style=for-the-badge) ![GitHub branch check runs](https://img.shields.io/github/check-runs/AET-DevOps26/team-99-downtime/main?style=for-the-badge) ![Latest Release](https://img.shields.io/github/v/release/AET-DevOps26/team-99-downtime?style=for-the-badge&label=release)

Personal finance app — track expenses, manage budgets, and get spending alerts.

## Quick Start

```sh
docker compose up -d --build
```

Open **http://localhost:9099**. See [Development Setup](docs/development/SETUP.md) for the full guide (native Nx mode, endpoints, per-service instructions).

This also brings up the observability stack - metrics, logs and alerting in Grafana at **http://localhost:3001** (log in as `admin` with the `GRAFANA_ADMIN_PASSWORD` you set in `.env`). See [Observability](docs/deployment/OBSERVABILITY.md).

## Live Environments

| Environment | App                                                 | Drizzle Studio                                   |
| ----------- | --------------------------------------------------- | ------------------------------------------------ |
| Stage       | https://stage.t99.stud.k8s.aet.cit.tum.de           | https://studio.stage.t99.stud.k8s.aet.cit.tum.de |
| Prod        | https://t99.stud.k8s.aet.cit.tum.de                 | https://studio.t99.stud.k8s.aet.cit.tum.de       |
| Azure VM    | https://expenseflow.spaincentral.cloudapp.azure.com | —                                                |

### Observability

Metrics, dashboards and alerting. Gated by GitHub - repo collaborators only, one
login per environment.

| Environment | Grafana                                     | Alertmanager                                       | Alert mail                                       |
| ----------- | ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Prod        | https://grafana.t99.stud.k8s.aet.cit.tum.de | https://grafana.t99.stud.k8s.aet.cit.tum.de/alerts | https://grafana.t99.stud.k8s.aet.cit.tum.de/mail |
| Local       | http://localhost:3001                       | http://localhost:9093                              | http://localhost:8025                            |

Alert mail is captured by MailHog, not delivered; no SMTP credentials are stored.
See [Observability](docs/deployment/OBSERVABILITY.md).

## Deployment

Every push to `main` is automatically deployed to **stage**. Promote to **prod** via the _Deploy to Production_ workflow dispatch in GitHub Actions. For manual deploys: `bun deploy:k8s`. See [Kubernetes Deployment](docs/deployment/KUBERNETES.md).

## Team

All three members contributed across the full stack throughout the project. Responsibilities rotated heavily — the areas below reflect where each person took the lead, not exclusive ownership.

| Member                                                              | Primary focus                                                                                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Daniel Günther ([@danielgnth](https://github.com/danielgnth))       | Monorepo tooling (NX), CI/CD pipelines, Kubernetes / Helm infrastructure                                                          |
| Stefania Mocan ([@stefaniamocan](https://github.com/stefaniamocan)) | Azure VM deployment (Terraform + Ansible), Docker Compose stack, OpenAPI generation, architecture docs                            |
| Bilgehan Savgu ([@bilgehansavgu](https://github.com/bilgehansavgu)) | Java microservices foundation, authentication (Better Auth), React client (UI/shadcn), budget feature, Caddy setup, GenAI service |

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
| Observability               | [docs/deployment/OBSERVABILITY.md](docs/deployment/OBSERVABILITY.md)           |
| Problem statement           | [docs/problem/PROBLEM_STATEMENT.md](docs/problem/PROBLEM_STATEMENT.md)         |
