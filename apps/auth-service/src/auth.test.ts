import { describe, it, expect, beforeAll } from 'bun:test';

// Better Auth warns (and in production throws) without a secret. Provide a
// deterministic one before importing the config so the smoke test is isolated
// from the environment and needs no database.
describe('auth-service', () => {
  let auth: typeof import('./auth').auth;

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET ||= 'test-only-secret-at-least-32-chars-long';
    ({ auth } = await import('./auth'));
  });

  it('exposes a request handler', () => {
    expect(typeof auth.handler).toBe('function');
  });

  it('serves the built-in health check without a database', async () => {
    const res = await auth.handler(new Request('http://localhost:3000/api/auth/ok'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
