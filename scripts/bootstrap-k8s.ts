#!/usr/bin/env bun
import { $ } from 'bun';

console.log('=== ExpenseFlow K8s Bootstrap ===\n');

// 1. Add Helm repo for ArgoCD
console.log('Adding Helm repos...');
await $`helm repo add argo https://argoproj.github.io/argo-helm`;
await $`helm repo update`;

// 2. Install ArgoCD
console.log('\nInstalling ArgoCD...');
await $`helm upgrade --install argocd argo/argo-cd \
  -n t99-argo-cd \
  -f k8s/bootstrap/argocd-values.yaml \
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

console.log('\nBootstrap complete. ArgoCD and Kargo are ready.');
console.log('Next: setting up Kubernetes secrets...\n');

// 6. Run secrets creation script
await import('./create-secrets');
