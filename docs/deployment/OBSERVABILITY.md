# Observability (Prometheus, Loki, Grafana)

Two of the three pillars, wired into one Grafana:

| Pillar      | Collected by                               | Stored in  | Answers                  |
| ----------- | ------------------------------------------ | ---------- | ------------------------ |
| **Metrics** | Prometheus scraping `/actuator/prometheus` | Prometheus | _Is it working?_         |
| **Logs**    | Promtail tailing container stdout          | Loki       | _Why is it not working?_ |
| Traces      | not collected                              | -          | -                        |

**Alertmanager** mails out firing alerts: through **Resend** on the cluster, and
into **MailHog** locally so no SMTP credentials are needed for dev. Everything is
configured from files in the repo - nothing is set up through the Grafana UI.

- Local stack: [`docker-compose.yaml`](../../docker-compose.yaml) (the observability block at the bottom)
- Cluster: the app's Helm chart, [`k8s/helm/t99-app/templates/monitoring/`](../../k8s/helm/t99-app/templates/monitoring/)
- Compose config: [`infra/monitoring/`](../../infra/monitoring/)
- Dashboards and alert rules: [`k8s/helm/t99-app/files/`](../../k8s/helm/t99-app/files/) - shared by both

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

Part of the app's Helm chart (`k8s/helm/t99-app`), deployed to **stage and prod**
by the same pipeline as the app - no separate tool, no separate workflow. Guarded
by `monitoring.enabled`.

It lives in the app's own namespace rather than a dedicated one: on the shared AET
cluster we hold no cluster-scoped rights (no ClusterRole, no cross-namespace pod
listing), so Prometheus uses a namespaced Role and discovers only our own pods.

### Access

| UI           | Stage                                               | Prod                                          |
| ------------ | --------------------------------------------------- | --------------------------------------------- |
| Grafana      | <https://grafana.stage.t99.stud.k8s.aet.cit.tum.de> | <https://grafana.t99.stud.k8s.aet.cit.tum.de> |
| Alertmanager | <https://alerts.stage.t99.stud.k8s.aet.cit.tum.de>  | <https://alerts.t99.stud.k8s.aet.cit.tum.de>  |

Both sit behind **Drizzle Studio's oauth2-proxy**, reached through nginx's
external-auth hooks. The proxy sets its cookie on the parent domain, so one
GitHub login covers Studio, Grafana and Alertmanager - one OAuth app per
environment, no second one to register.

Past the proxy you are an anonymous Grafana **Viewer**. Editing dashboards needs
the admin account:

```sh
kubectl -n t99-stage get secret t99-grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
```

Prometheus has no ingress:

```sh
kubectl -n t99-stage port-forward svc/t99-prometheus 9090:9090
```

### Email

Alertmanager sends through **Resend**'s SMTP relay. The only credential is a
Resend API key, which doubles as the SMTP password (the username is literally
`resend`). It is stored in a Secret and mounted as a file, so it never appears in
an env var or in the rendered manifests.

| Value                       | Where                                              |
| --------------------------- | -------------------------------------------------- |
| `alertmanager.from` / `.to` | `values.yaml` - plain config, not a secret         |
| `alertmanager.resendApiKey` | `RESEND_API_KEY` repo secret, or the deploy script |

**The key is optional.** Without it the stack still deploys - Alertmanager just
has no receiver, so alerts fire and show in its UI but nothing is mailed. That
keeps `bun deploy:k8s` working for anyone without the key.

### Sizing

The namespace `ResourceQuota` caps **limits**, not requests, and is shared with
the app:

| Pod          | Memory limit | CPU limit |
| ------------ | ------------ | --------- |
| prometheus   | 256Mi        | 150m      |
| grafana      | 192Mi        | 75m       |
| alertmanager | 64Mi         | 40m       |
| **total**    | **512Mi**    | **265m**  |

Leave headroom: cert-manager starts a short-lived 64Mi/100m pod to issue and
renew the TLS certificates. Check with `kubectl get resourcequota -n t99-stage`.

Loki and MailHog run locally only.

## Dashboards

| Dashboard                                                                         | File                    |
| --------------------------------------------------------------------------------- | ----------------------- |
| Service Overview (availability, request rate, errors, latency, version, **logs**) | `service-overview.json` |
| JVM Runtime (heap, GC, threads, CPU, uptime)                                      | `jvm-runtime.json`      |

Dashboards are provisioned from JSON, so you don't import them by hand. They live
in `k8s/helm/t99-app/files/dashboards/` - inside the chart, because Helm can only
read files under the chart directory. The Compose stack mounts the same folder, so
there is one copy, not two. To **update** one, edit the JSON and redeploy (or
restart the Grafana container locally).

To **export** a change made in the Grafana UI back into the repo: open the
dashboard → **Share → Export → Save to file** (leave _Export for sharing
externally_ off), then overwrite the matching file in
`k8s/helm/t99-app/files/dashboards/`.

To **import** into a Grafana that isn't using provisioning: **Dashboards → New →
Import → Upload JSON file** and pick the Prometheus data source.

## Alerting

```
Prometheus                Alertmanager                 MailHog
evaluates rules   ──────► groups, deduplicates, ─────► catches the mail
every 15s                 routes by severity           (localhost:8025)
```

Rules are defined twice, in the same shape: `infra/monitoring/rules/alerts.yaml`
(Compose) and `k8s/helm/t99-app/files/rules/alerts.yaml` (cluster). They differ
only in the `ServiceDown` scrape job, since discovery works differently.

Routing lives in `infra/monitoring/alertmanager.yml` for Compose, and in the
chart's `alertmanager.yaml` template for the cluster - same grouping, inhibition
and severity timings, different SMTP target (MailHog vs Resend).

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

**On the cluster:** Resend's SMTP relay delivers it for real. See
[Email](#email) above.

**Locally:** **MailHog**, a capture-only SMTP server - it accepts every message
and shows it in a web UI instead of delivering it. No credentials needed to
develop against the alerting path, and no risk of a dev stack mailing anyone.

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

The same request works against the cluster's Alertmanager
(`https://alerts.<domain>/api/v2/alerts`) to test the Resend path end to end.
