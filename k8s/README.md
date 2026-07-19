# k8s/

Helm chart for deploying ExpenseFlow to Kubernetes.

For full documentation see [docs/deployment/KUBERNETES.md](../docs/deployment/KUBERNETES.md).

The source monitoring configuration lives in
[`infra/monitoring/`](../infra/monitoring/), with Kubernetes resources in the
Helm [`monitoring/`](helm/t99-app/templates/monitoring/) templates. See
[docs/deployment/OBSERVABILITY.md](../docs/deployment/OBSERVABILITY.md).
