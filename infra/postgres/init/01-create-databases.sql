-- One database per microservice. Idempotent so the db-init service can re-run
-- it on every startup — Postgres init scripts only run on a fresh volume.
SELECT format('CREATE DATABASE %I', service_db)
FROM unnest(ARRAY['transaction_db', 'budget_db', 'auth_db', 'notification_db', 'genai_db']) AS t(service_db)
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = service_db)
\gexec
