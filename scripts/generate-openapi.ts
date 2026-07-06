#!/usr/bin/env bun
/**
 * Regenerate the committed OpenAPI specs and the typed frontend client at
 * build time — no running containers required. This is the whole pipeline;
 * run it as `bun run openapi`:
 *
 *   1. Spring services (budget/transaction/notification) — the springdoc
 *      Gradle plugin (`./gradlew generateOpenApiDocs`) boots each service
 *      against embedded H2, fetches its spec and writes openapi/<service>.json
 *      (a no-op when nothing changed, thanks to Gradle's up-to-date checks).
 *   2. genai-service — `nx run genai-service:export-openapi`: FastAPI builds
 *      the schema in-memory from the route decorators, no server started.
 *   3. auth-service — Better Auth's openAPI plugin, extracted in-process;
 *      paths are re-rooted under /api/auth (the gateway route).
 *   4. Canonicalise every spec in openapi/: recursively sorted keys, no
 *      `servers` block (it would embed the generation-time port), 2-space
 *      indent, trailing newline. The CI drift check compares bytes, so the
 *      output must be identical regardless of which machine/JVM produced it.
 *   5. openapi-typescript over each spec → the typed `paths`/`components`
 *      modules under apps/client/src/shared/api/generated/ that the client's
 *      shared apiClient (openapi-fetch) is typed against.
 */
import { join } from 'node:path';
import { $ } from 'bun';

const repoRoot = join(import.meta.dir, '..');
const specDir = join(repoRoot, 'openapi');
const outDir = join(repoRoot, 'apps', 'client', 'src', 'shared', 'api', 'generated');

// Every listed spec is canonicalised and fed to codegen below.
const services = [
  'budget-service',
  'transaction-service',
  'notification-service',
  'genai-service',
  'auth-service',
];

// ---------------------------------------------------------------------------
// Spring services — springdoc Gradle plugin
// ---------------------------------------------------------------------------

console.log('spring services: ./gradlew generateOpenApiDocs');
await $`./gradlew generateOpenApiDocs`.cwd(repoRoot);

// ---------------------------------------------------------------------------
// genai-service — FastAPI schema, exported in-memory
// ---------------------------------------------------------------------------

console.log('genai-service: nx run genai-service:export-openapi');
// Not .quiet(): when this fails in CI, the underlying error must be in the log.
await $`bun nx run genai-service:export-openapi`.cwd(repoRoot);

// ---------------------------------------------------------------------------
// auth-service — Better Auth openAPI plugin, extracted in-process
// ---------------------------------------------------------------------------

// The auth config reads its environment at import time; none of these values
// influence the schema, they only keep the import warning-free without a .env.
process.env.BETTER_AUTH_SECRET ??= 'openapi-codegen-only';
process.env.BETTER_AUTH_URL ??= 'http://localhost:9099';
process.env.BETTER_AUTH_TELEMETRY ??= '0';

console.log('auth-service: extracting schema via better-auth openAPI plugin');
const { auth } = await import('../apps/auth-service/src/auth');
const authSchema = await auth.api.generateOpenAPISchema();
// Better Auth emits paths relative to its base path; re-root them on the
// gateway route so they merge cleanly with the other services' path types.
const authSpec = {
  ...authSchema,
  paths: Object.fromEntries(
    Object.entries(authSchema.paths).map(([path, item]) => [`/api/auth${path}`, item])
  ),
};
await Bun.write(join(specDir, 'auth-service.json'), JSON.stringify(authSpec));

// ---------------------------------------------------------------------------
// Canonicalise all specs, then emit the typed client modules
// ---------------------------------------------------------------------------

/** Recursively sorts object keys; array order is semantic and left untouched. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeysDeep(record[key])])
    );
  }
  return value;
}

for (const name of services) {
  const specFile = join(specDir, `${name}.json`);
  const spec = (await Bun.file(specFile).json()) as Record<string, unknown>;
  // The servers block only ever carries the generation-time host:port — noise
  // at best, non-deterministic at worst. Requests go same-origin via the gateway.
  delete spec.servers;
  await Bun.write(specFile, `${JSON.stringify(sortKeysDeep(spec), null, 2)}\n`);
  console.log(`${name}: canonicalised openapi/${name}.json`);

  const out = join(outDir, `${name}.ts`);
  await $`bunx openapi-typescript ${specFile} --output ${out}`.cwd(repoRoot);
  console.log(`${name}: wrote generated/${name}.ts`);
}

console.log(`\nDone. Specs in openapi/, typed client modules in ${outDir}.`);
