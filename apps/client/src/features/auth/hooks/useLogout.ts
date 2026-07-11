import { toast } from 'sonner';

import { signOut } from '../api/authApi';

/**
 * hooks: sign the user out, then send them to the login screen.
 */
export function useLogout() {
  return async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(error.message ?? 'Could not sign out. Please try again.');
      return;
    }

    // A document navigation discards Better Auth's cached session state and
    // unmounts protected-page requests, so neither can race the login guard.
    window.location.replace('/login');
  };
}
