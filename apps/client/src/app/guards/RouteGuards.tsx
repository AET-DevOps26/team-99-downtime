import { Navigate, Outlet } from 'react-router-dom';

import { useSession } from '@/features/auth';
import { Wordmark } from '@/shared/ui/wordmark';

function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Wordmark className="animate-pulse" />
    </div>
  );
}

/**
 * Only renders child routes for an authenticated session, otherwise redirects to
 * the login screen.
 */
export function ProtectedRoute() {
  const { data, isPending } = useSession();

  if (isPending) return <SessionLoading />;
  return data ? <Outlet /> : <Navigate to="/login" replace />;
}

/**
 * Guest-only screens (login/sign-up): authenticated users are bounced to home.
 */
export function GuestRoute() {
  const { data, isPending } = useSession();

  if (isPending) return <SessionLoading />;
  return data ? <Navigate to="/" replace /> : <Outlet />;
}
