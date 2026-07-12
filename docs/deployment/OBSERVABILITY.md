# Observability (Prometheus, Loki, Grafana)

Two of the three pillars, wired into one Grafana:

| Pillar      | Collected by                               | Stored in  | Answers                  |
| ----------- | ------------------------------------------ | ---------- | ------------------------ |
| **Metrics** | Prometheus scraping `/actuator/prometheus` | Prometheus | _Is it working?_         |
| **Logs**    | Promtail tailing container stdout          | Loki       | _Why is it not working?_ |
| Traces      | not collected                              | -          | -                        |

**Alertmanager** mails out firing alerts; **MailHog** catches those mails so no
SMTP credentials are needed. Everything is configured from files in the repo -
nothing is set up through the Grafana UI.

- Local stack: [`docker-compose.yaml`](../../docker-compose.yaml) (the observability block at the bottom)
- K8s manifests: [`k8s/monitoring/`](../../k8s/monitoring/)
- Config: [`infra/monitoring/`](../../infra/monitoring/) · Dashboards: [`infra/grafana/dashboards/`](../../infra/grafana/dashboards/)

All five backend services expose the same metric names, so they share one set of
dashboard panels and alert rules:

| Service                           | Endpoint               | Instrumented with                      |
| --------------------------------- | ---------------------- | -------------------------------------- |
| transaction, notification, budget | `/actuator/prometheus` | Micrometer (Spring Boot)               |
| auth                              | `/metrics`             | `prom-client` (`src/metrics.ts`)       |
| genai                             | `/metrics`             | `prometheus-client` (`src/metrics.py`) |

The Node and Python services deliberately emit Micrometer's names
(`http_server_requests_seconds_*`, `process_uptime_seconds`) tagged with
`application` and `version`, rather than their libraries' defaults - so they land
on the existing panels instead of needing their own.

The Angular client has no server to scrape, so it contributes **logs** only.

## Run locally

The stack is part of the main Compose file, so it comes up with everything else:

```sh
docker compose up --build -d
```

Grafana's admin password is **not** defaulted in the compose file - set
`GRAFANA_ADMIN_PASSWORD` in `.env` first (see `.env.example`) or compose refuses
to start it. That is deliberate: a stack that boots on `admin`/`admin` is one
port-forward away from being wide open.

| Service      | URL                                                               |
| ------------ | ----------------------------------------------------------------- |
| Grafana      | <http://localhost:3001> (`admin` + your `GRAFANA_ADMIN_PASSWORD`) |
| Prometheus   | <http://localhost:9090>                                           |
| Alertmanager | <http://localhost:9093>                                           |
| Alert mails  | <http://localhost:8025> (MailHog)                                 |
| Loki API     | <http://localhost:3100>                                           |

Datasources and dashboards are provisioned automatically.

## Logs

Promtail discovers containers over the Docker socket and ships their
stdout/stderr to Loki, labelling each stream with `job` (the Compose service
name), `container` and `stream` (stdout/stderr). Labels are deliberately
low-cardinality - never label logs with request ids, user ids or timestamps, as
each distinct value creates a new stream in Loki.

Query them in **Grafana → Explore → Loki**:

```logql
{job="budget-service"}                                  # everything from one service
{job="budget-service"} |= "ERROR"                        # only errors
sum(count_over_time({job="budget-service"}[5m]))         # log volume
sum by (job) (rate({job=~".+-service"} |~ "(?i)error" [5m]))   # error rate, all services
```

The **Service Overview** dashboard puts these next to the metrics: when the 5xx
panel spikes, the log panels below it show what was actually thrown.

## Deploy on Kubernetes

```sh
./k8s/monitoring/apply.sh            # deploy / update
./k8s/monitoring/apply.sh --delete   # tear down
```

Access via port-forward:

```sh
kubectl -n monitoring port-forward svc/grafana 3000:3000
kubectl -n monitoring port-forward svc/prometheus 9090:9090
```

> `apply.sh` generates a random Grafana admin password on first run and prints
> it once. Read it later with:
> `kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d`

## Dashboards

| Dashboard                                                                         | File                    |
| --------------------------------------------------------------------------------- | ----------------------- |
| Service Overview (availability, request rate, errors, latency, version, **logs**) | `service-overview.json` |
| JVM Runtime (heap, GC, threads, CPU, uptime)                                      | `jvm-runtime.json`      |

Dashboards are provisioned from JSON, so you don't import them by hand. To
**update** one, edit its file in `infra/grafana/dashboards/` and re-apply
(`./k8s/monitoring/apply.sh`, or restart the Grafana container locally).

To **export** a change made in the Grafana UI back into the repo: open the
dashboard → **Share → Export → Save to file** (leave _Export for sharing
externally_ off), then overwrite the matching file in
`infra/grafana/dashboards/`.

To **import** into a Grafana that isn't using provisioning: **Dashboards → New →
Import → Upload JSON file** and pick the Prometheus data source.

## Alerting

```
Prometheus                Alertmanager                 MailHog
evaluates rules   ──────► groups, deduplicates, ─────► catches the mail
every 15s                 routes by severity           (localhost:8025)
```

Rules are defined twice, in the same shape: `infra/monitoring/rules/alerts.yaml`
(Compose) and `k8s/monitoring/prometheus/rules.yaml` (cluster). Routing lives in
`infra/monitoring/alertmanager.yml`, shared by both.

### The rules

| Alert                   | Fires when                                | For | Severity | Group        |
| ----------------------- | ----------------------------------------- | --- | -------- | ------------ |
| `ServiceDown`           | a scrape target is unreachable            | 2m  | critical | availability |
| `PodRestartsHigh`       | >5 restarts in the last hour              | 5m  | critical | runtime      |
| `CriticalHttpErrorRate` | >20% of requests return 5xx               | 2m  | critical | traffic      |
| `HighHttpErrorRate`     | >5% of requests return 5xx                | 5m  | warning  | traffic      |
| `HighRequestLatencyP95` | p95 latency above 1s                      | 10m | warning  | traffic      |
| `HighCpuUsage`          | CPU above 80% of all cores                | 5m  | warning  | runtime      |
| `JvmHeapPressure`       | heap above 90% of max (JVM services only) | 10m | warning  | runtime      |
| `LlmGatewayUnavailable` | genai answers 502 `LLM_UNAVAILABLE`       | 2m  | warning  | traffic      |

Two levels on the same signal: 5xx above 5% is a `warning`, above 20% a
`critical`. `LlmGatewayUnavailable` stays a warning on purpose - the AI features
are dead but the rest of the app works, and the cause is outside the cluster.

### Severity decides how fast, not just how loud

| Severity   | First mail after | Repeats every |
| ---------- | ---------------- | ------------- |
| `critical` | 10s              | 1h            |
| `warning`  | 30s              | 12h           |

### Keeping the noise down

Three mechanisms, all in `alertmanager.yml`:

- **Grouping** by `alertname` + `application` - all firing instances of one
  problem on one service collapse into a single mail, not one per scrape.
- **Inhibition** - if a service is `critical` (down), its `warning` alerts
  (latency, error rate) are suppressed. A down service breaches every rule it
  has; that is one incident, not four mails.
- **`repeat_interval`** - a still-firing alert is not re-sent until the interval
  above has passed.

`ServiceDown` copies the target's `service` label into `application` so it groups
and inhibits alongside the Micrometer-based rules, which label by `application`.

### Testing the rules

The rules have unit tests - synthetic time series fed through the real rule
files, asserting each alert fires with the expected labels. A rule that never
fires looks like coverage but isn't.

```sh
docker run --rm -v "$PWD/infra/monitoring/rules:/rules:ro" -w /rules \
  --entrypoint promtool prom/prometheus:v3.5.5 test rules alerts_test.yaml
```

Add a test to `alerts_test.yaml` whenever you add a rule.

### Where the mail goes

Alertmanager sends to **MailHog**, a capture-only SMTP server: it accepts every
message and shows it in a web UI instead of delivering it. That means **no SMTP
credentials exist anywhere in this repo or the cluster** - nothing to leak, and
no personal university password sitting in a Kubernetes Secret that any
teammate can `kubectl get -o yaml`.

| UI           | Local                   | Cluster                                                         |
| ------------ | ----------------------- | --------------------------------------------------------------- |
| Alert mails  | <http://localhost:8025> | `kubectl -n monitoring port-forward svc/mailhog 8025:8025`      |
| Alertmanager | <http://localhost:9093> | `kubectl -n monitoring port-forward svc/alertmanager 9093:9093` |

To send real mail instead, point `smtp_smarthost` at a real relay and add the
`smtp_auth_*` settings for it. Use a shared/functional account, never a personal
one: a Kubernetes Secret is only base64, so anyone with `kubectl` can read it
back.

### Test that mail actually arrives

Fire a synthetic alert straight at Alertmanager - no need to break a service:

```sh
curl -XPOST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json' -d '[{
  "labels": {"alertname": "SmokeTest", "severity": "critical", "application": "budget-service"},
  "annotations": {"summary": "Testing the mail path"}
}]'
```

It shows in the Alertmanager UI immediately, and the mail lands in MailHog
(<http://localhost:8025>) about 10s later - that is the `group_wait` for
`critical`. A `warning` takes 30s. If it appears in Alertmanager but never in
MailHog, check `docker compose logs alertmanager`.
