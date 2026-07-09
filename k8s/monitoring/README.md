# k8s/monitoring/

Prometheus + Grafana observability stack for ExpenseFlow, deployed to the
dedicated `monitoring` namespace.

```sh
./apply.sh            # deploy / update
./apply.sh --delete   # tear down
```

For the full guide - design, local Compose stack, dashboards and how to
re-import them - see
[docs/deployment/OBSERVABILITY.md](../../docs/deployment/OBSERVABILITY.md).
