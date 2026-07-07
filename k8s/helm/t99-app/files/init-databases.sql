-- One database per microservice. Same idempotent shape as the compose variant
-- (infra/postgres/init): creates whatever is missing, no-ops otherwise. Runs in
-- two places: as a postgres initdb script on a fresh volume, and via the
-- pre-upgrade db-init hook Job on every helm deploy (initdb scripts alone never
-- re-run on an existing volume, so new databases would otherwise never appear).
SELECT format('CREATE DATABASE %I', service_db)
FROM unnest(ARRAY['transaction_db', 'budget_db', 'auth_db', 'notification_db', 'genai_db']) AS t(service_db)
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = service_db)
\gexec
