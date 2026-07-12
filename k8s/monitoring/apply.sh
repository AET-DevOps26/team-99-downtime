#!/usr/bin/env bash
# Deploy the observability stack into the app's namespace. Usage: ./apply.sh [--delete]
#
# The dashboards ConfigMap is generated from the committed JSON under infra/,
# which stays the single source of truth. The grafana-admin password and the
# oauth2-proxy cookie secret are generated on first run and never committed.
# Pod limits are sized to the namespace quota — see OBSERVABILITY.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$REPO_ROOT/infra/grafana/dashboards"
NAMESPACE="${NAMESPACE:-t99-stage}"

if [[ "${1:-}" == "--delete" ]]; then
  kubectl delete -k "$SCRIPT_DIR" --ignore-not-found
  kubectl delete configmap grafana-dashboards -n "$NAMESPACE" --ignore-not-found
  kubectl delete secret grafana-admin grafana-github -n "$NAMESPACE" --ignore-not-found
  exit 0
fi

# GitHub OAuth app for oauth2-proxy. Callback:
#   https://grafana.stage.t99.stud.k8s.aet.cit.tum.de/oauth2/callback
# Pass the credentials on first run; re-runs reuse the secret (and keep the
# cookie secret, so existing sessions survive):
#   GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... ./k8s/monitoring/apply.sh
if [[ -n "${GITHUB_CLIENT_ID:-}" && -n "${GITHUB_CLIENT_SECRET:-}" ]]; then
  cookie_secret="$(kubectl -n "$NAMESPACE" get secret grafana-github \
    -o jsonpath='{.data.cookie-secret}' 2>/dev/null | base64 -d || true)"
  [[ -n "$cookie_secret" ]] || cookie_secret="$(openssl rand -base64 32 | head -c 32)"

  kubectl create secret generic grafana-github \
    --namespace "$NAMESPACE" \
    --from-literal=client-id="$GITHUB_CLIENT_ID" \
    --from-literal=client-secret="$GITHUB_CLIENT_SECRET" \
    --from-literal=cookie-secret="$cookie_secret" \
    --dry-run=client -o yaml | kubectl apply -f -
elif ! kubectl -n "$NAMESPACE" get secret grafana-github >/dev/null 2>&1; then
  echo "error: no grafana-github secret, and GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are unset." >&2
  echo "       Re-run with those two variables set." >&2
  exit 1
fi

kubectl create configmap grafana-dashboards \
  --namespace "$NAMESPACE" \
  --from-file="$DASHBOARD_DIR" \
  --dry-run=client -o yaml | kubectl apply -f -

# Generate the Grafana admin password on first run only; re-runs keep it.
if ! kubectl -n "$NAMESPACE" get secret grafana-admin >/dev/null 2>&1; then
  admin_password="$(openssl rand -base64 24)"
  kubectl -n "$NAMESPACE" create secret generic grafana-admin \
    --from-literal=admin-user=admin \
    --from-literal=admin-password="$admin_password"
  echo "Generated Grafana admin password (store it now): $admin_password"
fi

kubectl apply -k "$SCRIPT_DIR"

cat <<EOF

Observability stack applied to namespace "$NAMESPACE".

Grafana:    https://grafana.stage.t99.stud.k8s.aet.cit.tum.de
            gated by oauth2-proxy: collaborators of the GitHub repo get in as
            Viewer. To edit, log in as "admin" at the bottom of the page:
            kubectl -n $NAMESPACE get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
Prometheus: kubectl -n $NAMESPACE port-forward svc/prometheus 9090:9090

Alert rules evaluate under Prometheus > Alerts, but nothing is mailed: there is
no Alertmanager here (namespace quota). Email alerting runs in local compose.
EOF
