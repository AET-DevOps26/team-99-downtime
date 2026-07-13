#!/usr/bin/env bash
# Deploy the observability stack. Usage: ./apply.sh [--delete]
#
# It runs in the app's own namespace — on the shared AET cluster we hold no
# cluster-scoped rights. See docs/deployment/OBSERVABILITY.md.
#
# The dashboards and alertmanager ConfigMaps are generated from the committed
# files under infra/, which stay the single source of truth. The Grafana admin
# password and the oauth2-proxy cookie secret are generated on first run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$REPO_ROOT/infra/grafana/dashboards"
ALERTMANAGER_CONFIG="$REPO_ROOT/infra/monitoring/alertmanager.yml"
NAMESPACE="t99-prod"
HOST="grafana.t99.stud.k8s.aet.cit.tum.de"

if [[ "${1:-}" == "--delete" ]]; then
  kubectl delete -k "$SCRIPT_DIR" --ignore-not-found
  kubectl delete configmap grafana-dashboards alertmanager-config -n "$NAMESPACE" --ignore-not-found
  kubectl delete secret grafana-admin grafana-github -n "$NAMESPACE" --ignore-not-found
  exit 0
fi

# GitHub OAuth app for oauth2-proxy. Callback: https://$HOST/oauth2/callback
# Re-runs reuse the cookie secret, so existing sessions survive.
if [[ -n "${GRAFANA_OAUTH_CLIENT_ID:-}" && -n "${GRAFANA_OAUTH_CLIENT_SECRET:-}" ]]; then
  cookie_secret="$(kubectl -n "$NAMESPACE" get secret grafana-github \
    -o jsonpath='{.data.cookie-secret}' 2>/dev/null | base64 -d || true)"
  [[ -n "$cookie_secret" ]] || cookie_secret="$(openssl rand -base64 32 | head -c 32)"

  kubectl create secret generic grafana-github \
    --namespace "$NAMESPACE" \
    --from-literal=client-id="$GRAFANA_OAUTH_CLIENT_ID" \
    --from-literal=client-secret="$GRAFANA_OAUTH_CLIENT_SECRET" \
    --from-literal=cookie-secret="$cookie_secret" \
    --dry-run=client -o yaml | kubectl apply -f -
elif ! kubectl -n "$NAMESPACE" get secret grafana-github >/dev/null 2>&1; then
  echo "error: no grafana-github secret in $NAMESPACE, and GRAFANA_OAUTH_CLIENT_ID /" >&2
  echo "       GRAFANA_OAUTH_CLIENT_SECRET are unset. Re-run with those two set." >&2
  exit 1
fi

kubectl create configmap grafana-dashboards \
  --namespace "$NAMESPACE" \
  --from-file="$DASHBOARD_DIR" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap alertmanager-config \
  --namespace "$NAMESPACE" \
  --from-file=alertmanager.yml="$ALERTMANAGER_CONFIG" \
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

Observability stack applied to "$NAMESPACE".

Grafana:    https://$HOST
Alerts:     https://$HOST/alerts   (Alertmanager)
Alert mail: https://$HOST/mail     (MailHog)

All of it sits behind oauth2-proxy: collaborators of the GitHub repo get in as
Viewer. To edit dashboards, log in as "admin" at the bottom of the Grafana page:
  kubectl -n $NAMESPACE get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d

Prometheus has no ingress:
  kubectl -n $NAMESPACE port-forward svc/prometheus 9090:9090
EOF
