import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins/jwt';
import { Pool } from 'pg';

/**
 * Better Auth configuration for the auth-service.
 *
 * `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are read from the environment, so
 * neither the signing secret nor the base URL lives in source control.
 */
export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  // The React client. The baseURL origin is trusted automatically.
  trustedOrigins: ['http://localhost:4200'],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    // Step 1 has no email sender wired up yet, so verification stays off.
    requireEmailVerification: false,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  // Persist rate-limit counters in Postgres so they survive restarts and work
  // across replicas (rate limiting is on by default in production).
  rateLimit: {
    storage: 'database',
  },

  // Mints JWTs (GET /api/auth/token) and exposes JWKS (GET /api/auth/jwks) so
  // the Spring/Python microservices can validate tokens without touching the
  // database. RS256 is used (instead of the EdDSA default) because it is
  // verified natively by Spring Security and Python (PyJWT) with no extra
  // crypto providers. Changing this requires clearing the `jwks` table so the
  // key regenerates under the new algorithm.
  plugins: [
    jwt({
      jwks: {
        keyPairConfig: { alg: 'RS256', modulusLength: 2048 },
      },
    }),
  ],
});
