#!/usr/bin/env bash
# Validates the auth wiring in docker-compose.prod.yaml.
#
# Every resource server verifies the JWT "iss" claim against AUTH_ISSUER,
# and auth-service mints tokens with iss = BETTER_AUTH_URL. If the two ever
# diverge (or AUTH_ISSUER is missing, falling back to the localhost dev
# default), every authenticated API call in production fails with 401.
set -euo pipefail
cd "$(dirname "$0")/.."

# Optional arg: compose file to check (default: the prod compose).
compose_file=${1:-docker-compose.prod.yaml}

# Dummy values for the variables Ansible normally renders into .env.
export REGISTRY=ghcr.io/example
export APP_IMAGE_TAG=check
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=dummy
export POSTGRES_DB=postgres
export PUBLIC_ORIGIN=https://origin.example.test
export BETTER_AUTH_SECRET=dummy
export GOOGLE_CLIENT_ID=dummy
export GOOGLE_CLIENT_SECRET=dummy
export LLM_API_KEY=dummy

docker compose -f "$compose_file" config --format json | node -e '
  const config = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const env = (svc) => config.services[svc]?.environment ?? {};
  let fail = false;

  const minted = env("auth-service").BETTER_AUTH_URL;
  if (minted !== process.env.PUBLIC_ORIGIN) {
    console.error(`FAIL: auth-service BETTER_AUTH_URL=${JSON.stringify(minted)}, expected PUBLIC_ORIGIN`);
    fail = true;
  }

  for (const svc of ["transaction-service", "budget-service", "notification-service", "genai-service"]) {
    const issuer = env(svc).AUTH_ISSUER;
    if (issuer !== minted) {
      console.error(`FAIL: ${svc} AUTH_ISSUER=${JSON.stringify(issuer)} does not match auth-service issuer ${JSON.stringify(minted)}`);
      fail = true;
    }
  }

  if (fail) {
    console.error("docker-compose.prod.yaml auth wiring is broken — see failures above.");
    process.exit(1);
  }
  console.log(`OK: auth-service and all resource servers agree on issuer ${JSON.stringify(minted)}.`);
'
