"""Service configuration read from the environment.

Mirrors the Java services: the JWKS endpoint is reached server-to-server on the
internal network, while the issuer is the browser-facing auth origin.
"""

import os

# Where to fetch the auth-service public keys (RSA, RS256).
AUTH_JWKS_URI = os.getenv("AUTH_JWKS_URI", "http://auth-service:3000/api/auth/jwks")

# The "iss" claim tokens must carry: BETTER_AUTH_URL = the Caddy gateway origin.
AUTH_ISSUER = os.getenv("AUTH_ISSUER", "http://localhost:9099")

# --- LLM gateway (Logos, OpenAI-compatible chat-completions API) ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://logos.aet.cit.tum.de:8080/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
