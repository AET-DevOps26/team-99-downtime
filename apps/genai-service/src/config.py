"""Service configuration read from the environment.

Mirrors the Java services: the JWKS endpoint is reached server-to-server on the
internal network, while the issuer is the browser-facing auth origin.
"""

import os

# Where to fetch the auth-service public keys (RSA, RS256).
AUTH_JWKS_URI = os.getenv("AUTH_JWKS_URI", "http://auth-service:3000/api/auth/jwks")

# The "iss" claim tokens must carry (BETTER_AUTH_URL on the auth-service).
AUTH_ISSUER = os.getenv("AUTH_ISSUER", "http://localhost:4200")
