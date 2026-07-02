"""Security-contract tests for the JWT auth dependency.

Like the Java MockMvc tests, these run offline but exercise the *real*
verification logic: we generate an RSA keypair in-test, sign a token with the
private key, and point the JWKS client at the matching public key — so the
signature, issuer and expiry checks in ``src.auth`` actually execute.
"""

import datetime

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from src import auth, config
from src.main import app

ISSUER = "http://localhost:9099"


@pytest.fixture
def rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def _issuer(monkeypatch):
    monkeypatch.setattr(config, "AUTH_ISSUER", ISSUER)
    monkeypatch.setattr(auth.config, "AUTH_ISSUER", ISSUER)


@pytest.fixture
def client(monkeypatch, rsa_key):
    # Make the auth module's JWKS lookup return our test public key, so the real
    # signature verification in require_user runs against a key we control.
    class _Key:
        key = rsa_key.public_key()

    monkeypatch.setattr(
        auth._jwk_client, "get_signing_key_from_jwt", lambda token: _Key()
    )
    return TestClient(app)


def _token(rsa_key, **overrides):
    now = datetime.datetime.now(datetime.timezone.utc)
    claims = {
        "sub": "user-123",
        "email": "user@team99.dev",
        "iss": ISSUER,
        "exp": now + datetime.timedelta(minutes=5),
        **overrides,
    }
    return jwt.encode(claims, rsa_key, algorithm="RS256")


def test_health_is_public(client):
    assert client.get("/health").status_code == 200


def test_rejects_request_without_token(client):
    assert client.get("/api/genai/me").status_code == 401


def test_rejects_garbage_token(client):
    res = client.get("/api/genai/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert res.status_code == 401


def test_rejects_wrong_issuer(client, rsa_key):
    token = _token(rsa_key, iss="http://evil.example.com")
    res = client.get("/api/genai/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_accepts_valid_token(client, rsa_key):
    token = _token(rsa_key)
    res = client.get("/api/genai/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"userId": "user-123", "email": "user@team99.dev"}


def test_accepts_token_with_audience_claim(client, rsa_key):
    # Real Better Auth tokens carry `aud`; PyJWT rejects those unless audience
    # verification is explicitly configured. Regression test for that footgun.
    token = _token(rsa_key, aud=ISSUER)
    res = client.get("/api/genai/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200


def test_protects_categorize_endpoint(client, rsa_key, monkeypatch):
    # Stub the extraction so the authorized path never talks to the LLM.
    async def fake_categorize(text, categories):
        return []

    monkeypatch.setattr("src.main.categorize", fake_categorize)

    # Without a token -> 401
    assert (
        client.post("/api/genai/categorize", json={"text": "coffee 3 eur"}).status_code
        == 401
    )
    # With a valid token -> past auth, into the handler
    token = _token(rsa_key)
    res = client.post(
        "/api/genai/categorize",
        json={"text": "coffee 3 eur"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
