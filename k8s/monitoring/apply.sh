#!/usr/bin/env bash
# Deploy the observability stack. Usage: ./apply.sh [--delete]
# The grafana-dashboards ConfigMap is generated from infra/grafana/dashboards/
# so the committed JSON stays the single source of truth.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$REPO_ROOT/infra/grafana/dashboards"
NAMESPACE="monitoring"

if [[ "${1:-}" == "--delete" ]]; then
  kubectl delete -k "$SCRIPT_DIR" --ignore-not-found
  kubectl delete configmap grafana-dashboards -n "$NAMESPACE" --ignore-not-found
  exit 0
fi

kubectl apply -f "$SCRIPT_DIR/namespace.yaml"

kubectl create configmap grafana-dashboards \
  --namespace "$NAMESPACE" \
  --from-file="$DASHBOARD_DIR" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -k "$SCRIPT_DIR"

cat <<EOF

Observability stack applied to namespace "$NAMESPACE".

Open Grafana:     kubectl -n $NAMESPACE port-forward svc/grafana 3000:3000
                  then browse http://localhost:3000  (default login admin / admin)
Open Prometheus:  kubectl -n $NAMESPACE port-forward svc/prometheus 9090:9090
EOF
