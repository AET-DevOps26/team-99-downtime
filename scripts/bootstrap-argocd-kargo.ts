#!/usr/bin/env bun
import { $ } from 'bun';

// Installs ArgoCD + Kargo and wires up the GitOps pipeline.
// Prerequisite: a cluster admin must pre-install ArgoCD CRDs once:
//   kubectl apply -k "https://github.com/argoproj/argo-cd/manifests/crds?ref=stable"
// After bootstrap, add to GitHub Actions:
//   Secret  KARGO_API_TOKEN — from Kargo UI → Service Accounts
//   Variable KARGO_SERVER   — https://kargo.t99.stud.k8s.aet.cit.tum.de

console.log('=== ExpenseFlow K8s Bootstrap (ArgoCD + Kargo) ===\n');

// 1. Add Helm repo for ArgoCD
console.log('Adding Helm repos...');
await $`helm repo add argo https://argoproj.github.io/argo-helm`;
await $`helm repo update`;

// 2. Install ArgoCD
// --skip-crds because we don't have cluster-scope write access for CRDs.
console.log('\nInstalling ArgoCD...');
await $`helm upgrade --install argocd argo/argo-cd \
  -n t99-argo-cd \
  -f k8s/bootstrap/argocd-values.yaml \
  --skip-crds \
  --wait \
  --timeout 5m`;

// 3. Install Kargo
console.log('\nInstalling Kargo...');
await $`helm upgrade --install kargo oci://ghcr.io/akuity/kargo-charts/kargo \
  -n t99-kargo \
  -f k8s/bootstrap/kargo-values.yaml \
  --wait \
  --timeout 5m`;

// 4. Apply Kargo manifests (Project, Warehouse, Stages)
console.log('\nApplying Kargo manifests...');
await $`kubectl apply -f k8s/kargo/`;

// 5. Apply ArgoCD root App of Apps
console.log('\nApplying ArgoCD root application...');
await $`kubectl apply -f k8s/argocd/root-app.yaml`;

console.log('\nArgoCD and Kargo are ready.');
console.log('Next: setting up Kubernetes secrets...\n');

// 6. Create secrets in both namespaces
await import('./create-secrets');
