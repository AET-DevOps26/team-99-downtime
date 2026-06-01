import { authClient } from '@/shared/lib/auth-client';

/**
 * hooks: typed wrapper over the SDK's session hook so routes and pages depend on
 * the feature's public API rather than the auth client directly.
 */
export function useSession() {
  return authClient.useSession();
}
