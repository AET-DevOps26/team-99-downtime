import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';

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
const DEMO_NAME = 'Demo User';

// Use a fixed password when DEMO_USER_PASSWORD is set (stage/demo deployments).
// Without it the account is locked with a random password — it still gets the
// fixed UUID so Flyway seed data in other services can reference it, but nobody
// can log in without deliberately setting the env var.
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? crypto.randomUUID();
if (!process.env.DEMO_USER_PASSWORD) {
  console.log(
    'auth-migrate: DEMO_USER_PASSWORD not set — demo account locked with random password.'
  );
}

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

  // Wrap the PK rename in a transaction so a mid-flight failure leaves the
  // database consistent. PostgreSQL rolls back DDL (DISABLE/ENABLE TRIGGER)
  // together with the DML on ROLLBACK, so no manual re-enable is needed on error.
  await pool.query('BEGIN');
  try {
    // Disable FK triggers so the PK update on "user" isn't blocked by
    // session.userId / account.userId referencing it.
    await pool.query('ALTER TABLE "user" DISABLE TRIGGER ALL');
    await pool.query('UPDATE "user" SET id = $1 WHERE id = $2', [DEMO_USER_ID, generatedId]);
    await pool.query('UPDATE session SET "userId" = $1 WHERE "userId" = $2', [
      DEMO_USER_ID,
      generatedId,
    ]);
    await pool.query('UPDATE account SET "userId" = $1 WHERE "userId" = $2', [
      DEMO_USER_ID,
      generatedId,
    ]);
    await pool.query('ALTER TABLE "user" ENABLE TRIGGER ALL');
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }

  console.log(`auth-migrate: demo user seeded (${DEMO_EMAIL}).`);
} else {
  console.log('auth-migrate: demo user already exists, skipping.');
}

await pool.end();
