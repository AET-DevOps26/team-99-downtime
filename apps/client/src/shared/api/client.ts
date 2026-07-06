import createClient from 'openapi-fetch';
import { authClient } from '@/shared/lib/auth-client';
import type { paths as AuthPaths } from './generated/auth-service';
import type { paths as BudgetPaths } from './generated/budget-service';
import type { paths as GenaiPaths } from './generated/genai-service';
import type { paths as NotificationPaths } from './generated/notification-service';
import type { paths as TransactionPaths } from './generated/transaction-service';

/**
 * The one typed HTTP client for every backend service (shared infrastructure).
 *
 * Every service's `paths` type (generated from the committed OpenAPI specs by
 * `bun run openapi`) is merged into a single map, so a call site reads
 * `apiClient.GET('/api/budgets/categories')` — the path already names the
 * service, no per-service client needed. URL, method, path/query params,
 * request body and response shape are all compile-checked against the spec:
 * renaming an endpoint breaks the build at every call site instead of
 * surfacing as a runtime 404.
 *
 * Requests stay gateway-relative (same origin, the Caddy gateway routes by
 * path); the middleware below attaches the Better Auth JWT once for all
 * callers (see docs/development/AUTHENTICATION.md).
 */
type ApiPaths = BudgetPaths & TransactionPaths & NotificationPaths & GenaiPaths & AuthPaths;

export const apiClient = createClient<ApiPaths>({ baseUrl: '/' });

apiClient.use({
  async onRequest({ request }) {
    // Same defensive pattern as useNotificationStream: a failed token fetch
    // must not abort the call with a raw exception — send unauthenticated and
    // let the backend 401, which unwrap() turns into a catchable ApiError.
    try {
      const { data } = await authClient.token();
      if (data?.token) {
        request.headers.set('Authorization', `Bearer ${data.token}`);
      }
    } catch {
      // proceed without Authorization
    }
    return request;
  },
});
