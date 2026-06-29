# 🔐 Developing with Auth

All backend endpoints are **secured**. A request without a valid JWT gets `401`.
This guide is how you work with that locally — get a token, call protected
routes, and secure new endpoints you add.

For the architecture (why JWT + JWKS, the issuer model), see
[`SERVICE_OVERVIEW.md`](../architecture/SERVICE_OVERVIEW.md) §1.

---

## Mental model (30 seconds)

- **auth-service** mints RS256 JWTs and publishes its public keys at `/api/auth/jwks`.
- Every other service is a **resource server**: it validates the token's
  signature against those public keys, checks expiry, and checks the `iss`
  (issuer) claim equals **`http://localhost:9099`** (the gateway origin). No
  service holds a secret or talks to the auth database.
- Everything goes through the **Caddy gateway at `http://localhost:9099`** —
  one origin. The browser/client never calls a service directly.

```
browser ──(cookie)──► auth-service ──► JWT
   │                                     │
   └──(Authorization: Bearer <JWT>)──► gateway ──► transaction / budget / notification / genai
                                                        │ validate via JWKS + issuer
```

> ⚠️ The issuer is `http://localhost:9099`. If you change the gateway port you
> must update `BETTER_AUTH_URL` **and** `AUTH_ISSUER` together, or every request
> 401s. See the README "Endpoints" section.

---

## One-time setup

```sh
cp .env.example .env
# set BETTER_AUTH_SECRET (openssl rand -base64 32)
# setting up Google OAuth creds is optional (trust me it works)
docker compose up -d --build
```

Open **http://localhost:9099**. On a fresh DB the `auth-migrate` job applies the
schema before auth-service starts.

---

## Getting a token

### From the React client

The Better Auth client is already wired up
([`apps/client/src/shared/lib/auth-client.ts`](../../apps/client/src/shared/lib/auth-client.ts)).
After the user signs in:

```ts
import { authClient } from '@/shared/lib/auth-client';

const { data } = await authClient.token();
const jwt = data?.token;
```

### From the terminal / Postman (manual testing)

Sign up (or sign in) to get a session cookie, then exchange it for a JWT. All
via the gateway:

```sh
BASE=http://localhost:9099

# sign up (min password length is 12)
curl -s -c /tmp/cj.txt -X POST $BASE/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@team99.dev","password":"supersecret123","name":"Dev"}'

# already have an account? sign in instead:
# curl -s -c /tmp/cj.txt -X POST $BASE/api/auth/sign-in/email \
#   -H 'Content-Type: application/json' \
#   -d '{"email":"dev@team99.dev","password":"supersecret123"}'

# exchange the session cookie for a JWT
TOKEN=$(curl -s -b /tmp/cj.txt $BASE/api/auth/token | sed 's/.*"token":"\([^"]*\)".*/\1/')
echo "$TOKEN"
```

In **Postman**: hit `POST {{BASE}}/api/auth/sign-in/email` with cookie jar
enabled, then `GET {{BASE}}/api/auth/token`, and copy `token` into a Bearer auth
header on subsequent requests.

---

## Calling a protected endpoint

All backend services are mounted under `/api/<service>` and know their own full
path — no prefix stripping at the gateway.

| Service      | External path           | Controller path (same) |
| ------------ | ----------------------- | ---------------------- |
| auth         | `…/api/auth/*`          | `/api/auth/*`          |
| transaction  | `…/api/transactions/*`  | `/api/transactions/*`  |
| budget       | `…/api/budgets/*`       | `/api/budgets/*`       |
| notification | `…/api/notifications/*` | `/api/notifications/*` |
| genai        | `…/api/genai/*`         | `/api/genai/*`         |

```sh
# 401 without a token, 200 with one
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/transactions/me
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" $BASE/api/transactions/me
```

Frontend (same-origin, use a relative path):

```ts
await fetch('/api/transactions/transactions', {
  headers: { Authorization: `Bearer ${jwt}` },
});
```

### Quick probes

Every backend exposes `GET /<service-prefix>/me` (returns the caller's
`userId`/`email`) — the fastest way to prove auth works end-to-end:
`/api/transactions/me`, `/api/budgets/me`, `/api/notifications/me`,
`/api/genai/me`.

---

## Securing a NEW endpoint or service

### Spring service

The JWT validation logic lives once in the shared
[`commons-jvm`](../../apps/commons-jvm) library
([`SecurityConfig.java`](../../apps/commons-jvm/src/main/java/de/tum/aet/devops26/team99downtime/commons/security/SecurityConfig.java)),
registered as a Spring Boot auto-configuration. A new Spring service wires it in
with two changes — no security code to copy:

1. Depend on the library in `build.gradle.kts`:

   ```kotlin
   implementation(project(":commons-jvm"))
   ```

2. Provide the two config values in `application.yaml`:

   ```yaml
   spring:
     security:
       oauth2:
         resourceserver:
           jwt:
             # server-to-server; NOT issuer-uri (that would trigger OIDC discovery
             # against the browser origin, which is unreachable inside the network)
             jwk-set-uri: ${AUTH_JWKS_URI:http://auth-service:3000/api/auth/jwks}
   auth:
     issuer: ${AUTH_ISSUER:http://localhost:9099}
   ```

The auto-configuration loads automatically (no component-scan needed) and brings
a `GET /{service-prefix}/me` probe with it (configured via `service.me-path` in
`application.yaml`). **Every route is then protected by default**. Routes are
opened explicitly via `permitAll()` — currently only `/actuator/health`.
New endpoints need no extra code to be secured; the caller's identity is in the
`Authentication` / JWT.

### genai (FastAPI)

Declare the dependency on any route that needs auth:

```python
from .auth import CurrentUser, require_user

@router.post("/something")
async def handler(user: CurrentUser = Depends(require_user)):
    ...  # user.user_id is the caller
```

Unlike Spring, FastAPI is **open by default** — a route is only protected if it
declares `Depends(require_user)`. Keep `/health` public for the container probe.
In tests, bypass with
`app.dependency_overrides[require_user] = lambda: CurrentUser(...)`.

### What stays public

| Service kind | Public (no token)                           |
| ------------ | ------------------------------------------- |
| Spring       | `/actuator/health`, `/actuator/health/**`   |
| genai        | `/health`                                   |
| auth         | `/api/auth/*` (sign-up/in, token, jwks, ok) |

---

## Troubleshooting `401`

| Symptom                                          | Likely cause                                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401 with no token                                | Expected — attach `Authorization: Bearer <jwt>`.                                                                                                    |
| 401 _with_ a token                               | Token expired (mint a fresh one), or `iss` mismatch — the service expects `http://localhost:9099`; confirm `AUTH_ISSUER` / `BETTER_AUTH_URL` agree. |
| All services 401 even with a valid-looking token | JWKS unreachable, or the gateway port / issuer was changed in one place but not the other.                                                          |
| Works on `:3000` direct but not via gateway      | You called the service's debug port directly; use the gateway (`http://localhost:9099/...`).                                                        |

Decode a token to inspect its claims:

```sh
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
# expect "iss": "http://localhost:9099"
```

</content>
