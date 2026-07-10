import { useNavigate } from 'react-router';

import { signOut } from '../api/authApi';
import { useSession } from './useSession';

/**
 * hooks: sign the user out, then send them to the login screen.
 */
export function useLogout() {
  const navigate = useNavigate();
  const { refetch } = useSession();

  return async () => {
    await signOut();
    // Better Auth refreshes its session store asynchronously after sign-out.
    // Wait for that refresh so the guest guard cannot see stale session data
    // and bounce back through the protected routes before reaching login.
    await refetch();
    navigate('/login', { replace: true });
  };
}
