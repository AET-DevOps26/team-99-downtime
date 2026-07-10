import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';

import { auth } from './auth';

/**
 * Applies the Better Auth schema to the database, seeds the demo user, then
 * exits. Run once by the `auth-migrate` container / Helm pre-install Job before
 * auth-service starts. Idempotent: only creates what is missing.
 */
const { runMigrations, toBeCreated, toBeAdded } = await getMigrations(auth.options);

if (toBeCreated.length === 0 && toBeAdded.length === 0) {
  console.log('auth-migrate: schema already up to date, nothing to do.');
} else {
  await runMigrations();
  console.log('auth-migrate: migration complete.');
}

// ── Demo user seed ─────────────────────────────────────────────────────────────
// Fixed UUID so the Flyway seed migrations in budget-service and
// transaction-service can reference it without cross-service coordination.
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000099';
const DEMO_EMAIL = 'demo@expenseflow.dev';
const DEMO_PASSWORD = 'demodemo1234!';
const DEMO_NAME = 'Demo User';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [
  DEMO_EMAIL,
]);

if (rows.length === 0) {
  // Create via Better Auth so password hashing and all account fields are handled correctly.
  const result = await auth.api.signUpEmail({
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME },
  });

  const generatedId = result.user.id;

  // Pin to fixed UUID so other services can reference it in their Flyway seeds.
  await pool.query('UPDATE "user" SET id = $1 WHERE id = $2', [DEMO_USER_ID, generatedId]);
  await pool.query('UPDATE account SET user_id = $1 WHERE user_id = $2', [
    DEMO_USER_ID,
    generatedId,
  ]);

  console.log(`auth-migrate: demo user seeded (${DEMO_EMAIL}).`);
} else {
  console.log('auth-migrate: demo user already exists, skipping.');
}

await pool.end();
