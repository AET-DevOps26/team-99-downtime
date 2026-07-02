import { authClient } from './auth-client';

/**
 * Shared infrastructure for calling the protected backend services through the
 * Caddy gateway. Every Spring/FastAPI service is an OAuth2 resource server, so
 * each request carries a Better Auth JWT as a bearer token (see
 * docs/development/AUTHENTICATION.md). This lives in shared/ because multiple
 * features (budgets, transactions, …) need it — never duplicate it per feature.
 */

/**
 * Thrown on a non-2xx response. Carries the HTTP status and the parsed JSON body
 * so callers can branch on the backend's error contract (e.g. 400 field errors,
 * 409 duplicate) instead of re-parsing strings.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await authClient.token();
  const token = data?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Authenticated fetch against a gateway-relative path (e.g. `/budgets/api/...`).
 * Attaches the bearer token, sets JSON content-type for bodies, and turns a
 * non-2xx response into an {@link ApiError}. Returns the parsed JSON, or
 * `undefined` for empty (204) responses.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  for (const [key, value] of Object.entries(await authHeaders())) {
    headers.set(key, value);
  }
  // Only string bodies are JSON; for FormData the browser must set the
  // multipart boundary itself, so never override its Content-Type.
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...options, headers });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  return body as T;
}
