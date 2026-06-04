import { getMigrations } from 'better-auth/db/migration';

import { auth } from './auth';

/**
 * Applies the Better Auth schema to the database, then exits. Run once by the
 * `auth-migrate` container before auth-service starts (and mirrors a Kubernetes
 * Job / initContainer in production).
 *
 * Uses the programmatic migration API with the service's own config and the
 * existing `pg` adapter — no CLI, no extra native dependencies. Idempotent: it
 * only creates what's missing.
 */
const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(auth.options);

if (toBeCreated.length === 0 && toBeAdded.length === 0) {
  console.log('auth-migrate: schema already up to date, nothing to do.');
} else {
  await runMigrations();
  console.log('auth-migrate: migration complete.');
}
