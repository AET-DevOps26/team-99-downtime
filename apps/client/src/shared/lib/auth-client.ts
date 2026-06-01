import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';

/**
 * The single Better Auth client instance (shared infrastructure).
 *
 * `baseURL` is left empty so requests go to the current origin (e.g.
 * http://localhost:4200/api/auth/*) and are proxied to the auth-service by Vite
 * (see vite.config.mts). This keeps auth calls same-origin, avoiding CORS and
 * matching the API-gateway model used in production.
 */
export const authClient = createAuthClient({
  plugins: [jwtClient()],
});
