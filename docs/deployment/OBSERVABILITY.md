# Observability (Prometheus + Grafana)

**Prometheus** scrapes metrics from the services; **Grafana** shows them on
dashboards kept as version-controlled JSON. Runs in Kubernetes and locally.

- K8s manifests: [`k8s/monitoring/`](../../k8s/monitoring/)
- Local overlay: [`docker-compose.monitoring.yaml`](../../docker-compose.monitoring.yaml)
- Dashboards: [`infra/grafana/dashboards/`](../../infra/grafana/dashboards/)

The three Spring Boot services expose Micrometer metrics at
`/actuator/prometheus`. Auth (Node), genai (Python) and client (Angular) are not
yet instrumented.

## Run locally

```sh
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d
```

- Grafana: <http://localhost:3001> (`admin` / `admin`)
- Prometheus: <http://localhost:9090>

The data source and both dashboards are provisioned automatically.

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

| Dashboard                                                               | File                    |
| ----------------------------------------------------------------------- | ----------------------- |
| Service Overview (availability, request rate, errors, latency, version) | `service-overview.json` |
| JVM Runtime (heap, GC, threads, CPU, uptime)                            | `jvm-runtime.json`      |

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

Rules for service-down, high error rate, slow latency and JVM heap pressure live
in `k8s/monitoring/prometheus/rules.yaml` (and `infra/monitoring/rules/` locally).
They show in the Prometheus **Alerts** tab; add an Alertmanager to route them to
email / Slack / PagerDuty.
