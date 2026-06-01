/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the auth-service (Better Auth), used as the Vite dev-proxy
   * target for /api/auth/*. Defaults to http://localhost:3000.
   */
  readonly VITE_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
