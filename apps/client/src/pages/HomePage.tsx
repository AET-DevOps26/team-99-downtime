import { Button } from '@/shared/ui/button';
import { Wordmark } from '@/shared/ui/wordmark';
import { useSession, useLogout } from '@/features/auth';

/**
 * Protected placeholder home. The real dashboard/transactions screens are owned
 * by other user stories; for now this confirms the session and offers sign-out.
 */
export function HomePage() {
  const { data } = useSession();
  const logout = useLogout();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Wordmark className="text-2xl" />
      <p className="text-muted-foreground">
        Signed in as <span className="text-foreground">{data?.user.email}</span>
      </p>
      <Button variant="outline" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}

export default HomePage;
