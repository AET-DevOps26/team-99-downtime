import { useNavigate } from 'react-router-dom';

import { signOut } from '../api/authApi';

/**
 * hooks: sign the user out, then send them to the login screen.
 */
export function useLogout() {
  const navigate = useNavigate();

  return async () => {
    await signOut();
    navigate('/login');
  };
}
