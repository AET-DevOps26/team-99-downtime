"""Authentication: validate the RS256 JWTs minted by the auth-service.

This is the security layer. It verifies a bearer token's signature against the
auth-service JWKS (RSA public keys), checks the issuer and expiry, and exposes
the caller's identity as a FastAPI dependency. The service holds no secret and
never talks to the auth database — verification is purely via the public keys.
"""

from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

# PyJWKClient fetches the JWKS once and caches keys, refreshing on an unknown
# `kid`. A module-level client keeps that cache across requests.
_jwk_client = jwt.PyJWKClient(config.AUTH_JWKS_URI)

# auto_error=False so a missing header yields our own 401 (not a 403).
_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    """The authenticated caller, derived from the validated token."""

    user_id: str
    email: str | None


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    """FastAPI dependency: require a valid bearer token, return the caller.

    Routes that need auth declare ``user: CurrentUser = Depends(require_user)``.
    In feature tests you can bypass this with
    ``app.dependency_overrides[require_user] = lambda: CurrentUser(...)`` rather
    than minting a real token.
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Missing bearer token")

    token = credentials.credentials
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=config.AUTH_ISSUER,
            # Better Auth tokens carry an `aud` claim; PyJWT rejects any token
            # with `aud` unless we opt in or out. The Java services validate
            # issuer only (Spring's default), so mirror that here.
            options={"require": ["exp", "iss", "sub"], "verify_aud": False},
        )
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid or expired token") from exc

    return CurrentUser(user_id=claims["sub"], email=claims.get("email"))
