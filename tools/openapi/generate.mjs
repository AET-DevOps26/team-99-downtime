/**
 * Regenerates the committed OpenAPI specs and the typed frontend client from the
 * RUNNING services. Start the stack first (`docker compose up -d` or `bun dev`),
 * then run `bun run openapi`.
 *
 * For each service it:
 *   1. fetches the live spec (springdoc /v3/api-docs, or FastAPI /openapi.json),
 *   2. writes it to openapi/<service>.json (committed — reviewable contract diff),
 *   3. runs openapi-typescript over it to emit the typed client module under
 *      apps/client/src/shared/api/generated/<service>.ts.
 *
 * The hand-written apiFetch wrapper still handles auth + the gateway prefix;
 * codegen only owns the request/response types.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const specDir = join(repoRoot, 'openapi');
const outDir = join(repoRoot, 'apps', 'client', 'src', 'shared', 'api', 'generated');

// name -> live spec URL (direct service ports, published by docker-compose).
// Spec paths live under each service's /api prefix since the routing unification (#96/#111).
const services = {
  'budget-service': 'http://localhost:8082/api/budgets/v3/api-docs',
  'transaction-service': 'http://localhost:8080/api/transactions/v3/api-docs',
  'notification-service': 'http://localhost:8081/api/notifications/v3/api-docs',
  'genai-service': 'http://localhost:8000/api/genai/openapi.json',
};

mkdirSync(specDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const failures = [];

for (const [name, url] of Object.entries(services)) {
  try {
    console.log(`\n${name}: GET ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const spec = await response.json();

    const specFile = join(specDir, `${name}.json`);
    writeFileSync(specFile, `${JSON.stringify(spec, null, 2)}\n`);
    console.log(`  wrote openapi/${name}.json`);

    const out = join(outDir, `${name}.ts`);
    execFileSync('bunx', ['openapi-typescript', specFile, '--output', out], {
      stdio: 'inherit',
      cwd: repoRoot,
      shell: true,
    });
  } catch (error) {
    failures.push({ name, url, message: error.message });
    console.error(`  FAILED: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(
    `\n${failures.length} service(s) unreachable: ${failures.map((f) => f.name).join(', ')}.` +
      `\nIs the stack running? Start it with "docker compose up -d" (or "bun dev"), then retry.`
  );
  process.exit(1);
}

console.log(`\nDone. Specs in openapi/, client in ${outDir}.`);
