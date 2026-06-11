#!/usr/bin/env bun
import { $ } from 'bun';
import { randomBytes } from 'crypto';

const namespaces = ['t99-stage', 't99-prod'];

// Generate secrets
const dbPassword = randomBytes(32).toString('hex');
const jwtSigningKey = randomBytes(64).toString('hex');

// Prompt for GHCR token interactively
const ghcrToken = prompt('Paste your GHCR personal access token: ');
if (!ghcrToken) {
  console.error('GHCR token is required');
  process.exit(1);
}

// Apply to both namespaces
for (const ns of namespaces) {
  console.log(`\nApplying secrets to namespace: ${ns}`);

  // 1. t99-db-credentials
  console.log(`  Applying t99-db-credentials...`);
  const dbCredsYaml =
    await $`kubectl create secret generic t99-db-credentials --from-literal=password=${dbPassword} -n ${ns} --dry-run=client -o yaml`.text();
  await $`kubectl apply -f -`.stdin(dbCredsYaml);

  // 2. t99-app-secrets
  console.log(`  Applying t99-app-secrets...`);
  const appSecretsYaml =
    await $`kubectl create secret generic t99-app-secrets --from-literal=jwtSigningKey=${jwtSigningKey} -n ${ns} --dry-run=client -o yaml`.text();
  await $`kubectl apply -f -`.stdin(appSecretsYaml);

  // 3. t99-ghcr-pull (docker-registry secret)
  console.log(`  Applying t99-ghcr-pull...`);
  const ghcrPullYaml =
    await $`kubectl create secret docker-registry t99-ghcr-pull --docker-server=ghcr.io --docker-username=aet-devops26 --docker-password=${ghcrToken} -n ${ns} --dry-run=client -o yaml`.text();
  await $`kubectl apply -f -`.stdin(ghcrPullYaml);
}

// Print summary
console.log('\n=== Generated Secrets (save these!) ===');
console.log(`DB Password:     ${dbPassword}`);
console.log(`JWT Signing Key: ${jwtSigningKey}`);
console.log('GHCR Token:      (as entered)');
