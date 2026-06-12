#!/usr/bin/env bun
export {};

console.log('=== ExpenseFlow K8s Bootstrap ===\n');
console.log('This script creates the Kubernetes secrets required before the first deploy.');
console.log('Run once per namespace (t99-stage and t99-prod are both covered).\n');

await import('./create-secrets');
