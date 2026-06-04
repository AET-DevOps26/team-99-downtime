import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';

/**
 * The single Better Auth client instance (shared infrastructure).
 *
 * `baseURL` is left empty so requests go to the current origin
 * (http://localhost:9099/api/auth/*). The Caddy gateway routes /api/auth to the
 * auth-service, so calls stay same-origin (no CORS), matching the production
 * API-gateway model.
 */
export const authClient = createAuthClient({
  plugins: [jwtClient()],
});
