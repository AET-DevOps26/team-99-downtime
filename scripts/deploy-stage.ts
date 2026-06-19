#!/usr/bin/env bun
/**
 * Deploy the latest Helm release to the stage environment.
 *
 * Usage:
 *   bun run scripts/deploy-stage.ts [-n <namespace>]
 *
 * GitHub OAuth credentials are read from the existing cluster secret when
 * present; you are only prompted when the secret does not yet exist.
 */
import { $ } from 'bun';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

let namespace = 't99-stage';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '-n' || args[i] === '--namespace') && args[i + 1]) {
    namespace = args[i + 1];
    i++;
  }
}

// ---------------------------------------------------------------------------
// Version — latest git tag
// ---------------------------------------------------------------------------

let version: string;
try {
  version = (await $`git describe --tags --abbrev=0`.quiet().text()).trim().replace(/^v/, '');
} catch {
  console.error('No git tags found. Tag a release first (e.g. git tag v0.1.0).');
  process.exit(1);
}

console.log(`\nDeploying v${version} → ${namespace}\n`);

// ---------------------------------------------------------------------------
// GitHub OAuth credentials — read from cluster or prompt
// ---------------------------------------------------------------------------

let clientId = '';
let clientSecret = '';

try {
  const raw = await $`kubectl get secret t99-studio-oauth2 -n ${namespace} -o json`.quiet().text();
  const { data = {} } = JSON.parse(raw);
  clientId = data.clientId ? atob(data.clientId) : '';
  clientSecret = data.clientSecret ? atob(data.clientSecret) : '';
} catch {
  // secret not yet present — will prompt below
}

if (clientId && clientSecret) {
  console.log('✓ GitHub OAuth credentials found in cluster\n');
} else {
  console.log('GitHub OAuth credentials not found — enter them now:');
  console.log('(note: input is visible in the terminal)\n');
  clientId = prompt('  Client ID:     ') ?? '';
  clientSecret = prompt('  Client Secret: ') ?? '';
  console.log('');
  if (!clientId || !clientSecret) {
    console.error('Both Client ID and Client Secret are required.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Helm deploy
// ---------------------------------------------------------------------------

await $`helm upgrade --install t99 k8s/helm/t99-app/ \
  -n ${namespace} \
  -f k8s/helm/t99-app/values.yaml \
  -f k8s/helm/t99-app/values.stage.yaml \
  --set ${'authService.image.tag=' + version} \
  --set ${'client.image.tag=' + version} \
  --set ${'transactionService.image.tag=' + version} \
  --set ${'notificationService.image.tag=' + version} \
  --set ${'budgetService.image.tag=' + version} \
  --set ${'genaiService.image.tag=' + version} \
  --set ${'drizzleStudio.github.clientId=' + clientId} \
  --set ${'drizzleStudio.github.clientSecret=' + clientSecret} \
  --wait --timeout 5m --rollback-on-failure`;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const domain =
  namespace === 't99-prod' ? 't99.stud.k8s.aet.cit.tum.de' : 'stage.t99.stud.k8s.aet.cit.tum.de';

console.log(`\n✓ Deployed v${version} to ${namespace}`);
console.log(`  App:    https://${domain}`);
console.log(`  Studio: https://studio.${domain}\n`);
