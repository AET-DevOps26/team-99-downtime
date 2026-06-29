import { Navigate, Outlet } from 'react-router';

import { useSession } from '@/features/auth';
import { Wordmark } from '@/shared/ui/wordmark';

function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Wordmark className="animate-pulse" />
    </div>
  );
}

export default function GuestLayout() {
  const { data, isPending } = useSession();

  if (isPending) return <SessionLoading />;
  return data ? <Navigate to="/" replace /> : <Outlet />;
}
