/**
 * Shared error contract for the protected backend services. The requests
 * themselves go through the typed `apiClient` (shared/api/client.ts, which
 * also attaches the bearer token); this module owns what a failure looks
 * like, so feature code can branch on the backend's error contract (e.g.
 * 400 field errors, 409 duplicate) instead of re-parsing strings. It lives
 * in shared/ because multiple features (budgets, transactions, …) need it —
 * never duplicate it per feature.
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

/** Status plus the backend's error contract (`code` = `error`, `fields` for 400s). */
export interface ApiErrorInfo {
  status: number;
  code?: string;
  fields?: Record<string, string>;
}

/** Reads status/code/fields off an {@link ApiError}, or undefined for any other error. */
export function apiErrorInfo(err: unknown): ApiErrorInfo | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const body = err.body as { error?: string; fields?: Record<string, string> } | undefined;
  return { status: err.status, code: body?.error, fields: body?.fields };
}

/**
 * Unwraps an openapi-fetch result: returns `data` on success, throws an
 * {@link ApiError} carrying the HTTP status and parsed error body otherwise.
 * Keeps the feature wrappers on the promise-or-throw contract the hooks and
 * modals were built around.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined) {
    throw new ApiError(result.response.status, result.error);
  }
  return result.data as T;
}
