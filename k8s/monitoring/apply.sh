#!/usr/bin/env bash
# Deploy the observability stack. Usage: ./apply.sh [stage|prod] [--delete]
#
# It runs in the app's own namespace — on the shared AET cluster we hold no
# cluster-scoped rights. Stage is metrics only (quota); prod also runs
# Alertmanager + MailHog. See docs/deployment/OBSERVABILITY.md.
#
# The dashboards and alertmanager ConfigMaps are generated from the committed
# files under infra/, which stay the single source of truth. The Grafana admin
# password and the oauth2-proxy cookie secret are generated on first run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$REPO_ROOT/infra/grafana/dashboards"
ALERTMANAGER_CONFIG="$REPO_ROOT/infra/monitoring/alertmanager.yml"

ENV="${1:-stage}"
case "$ENV" in
  stage) NAMESPACE="t99-stage" ;;
  prod) NAMESPACE="t99-prod" ;;
  *)
    echo "usage: $0 [stage|prod] [--delete]" >&2
    exit 1
    ;;
esac
OVERLAY="$SCRIPT_DIR/overlays/$ENV"

if [[ "${2:-}" == "--delete" ]]; then
  kubectl delete -k "$OVERLAY" --ignore-not-found
  kubectl delete configmap grafana-dashboards alertmanager-config -n "$NAMESPACE" --ignore-not-found
  kubectl delete secret grafana-admin grafana-github -n "$NAMESPACE" --ignore-not-found
  exit 0
fi

# GitHub OAuth app for oauth2-proxy — one per environment, since an OAuth app
# allows a single callback URL. Callback:
#   https://<grafana host>/oauth2/callback
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

if [[ "$ENV" == "prod" ]]; then
  kubectl create configmap alertmanager-config \
    --namespace "$NAMESPACE" \
    --from-file=alertmanager.yml="$ALERTMANAGER_CONFIG" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

# Generate the Grafana admin password on first run only; re-runs keep it.
if ! kubectl -n "$NAMESPACE" get secret grafana-admin >/dev/null 2>&1; then
  admin_password="$(openssl rand -base64 24)"
  kubectl -n "$NAMESPACE" create secret generic grafana-admin \
    --from-literal=admin-user=admin \
    --from-literal=admin-password="$admin_password"
  echo "Generated Grafana admin password (store it now): $admin_password"
fi

kubectl apply -k "$OVERLAY"

if [[ "$ENV" == "prod" ]]; then
  host="grafana.t99.stud.k8s.aet.cit.tum.de"
else
  host="grafana.stage.t99.stud.k8s.aet.cit.tum.de"
fi

cat <<EOF

Observability stack applied to "$NAMESPACE".

Grafana:    https://$host
$(if [[ "$ENV" == "prod" ]]; then
  echo "Alerts:     https://$host/alerts   (Alertmanager)"
  echo "Alert mail: https://$host/mail     (MailHog)"
else
  echo "            stage is metrics only: no Alertmanager, no mail. Alert rules"
  echo "            show under Prometheus > Alerts."
fi)

All of it sits behind oauth2-proxy: collaborators of the GitHub repo get in as
Viewer. To edit dashboards, log in as "admin" at the bottom of the Grafana page:
  kubectl -n $NAMESPACE get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d

Prometheus has no ingress:
  kubectl -n $NAMESPACE port-forward svc/prometheus 9090:9090
EOF
