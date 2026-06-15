import { useState } from 'react';
import { SlidersHorizontalIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Wordmark } from '@/shared/ui/wordmark';
import { useSession, useLogout } from '@/features/auth';
import { ManageCategoriesModal } from '@/features/budgets';

/**
 * Protected placeholder home. The real dashboard/transactions screens are owned
 * by other user stories; for now this confirms the session, offers sign-out, and
 * opens the budget category manager (US-1).
 */
export function HomePage() {
  const { data } = useSession();
  const logout = useLogout();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Wordmark className="text-2xl" />
      <p className="text-muted-foreground">
        Signed in as <span className="text-foreground">{data?.user.email}</span>
      </p>
      <div className="flex gap-3">
        <Button onClick={() => setCategoriesOpen(true)}>
          <SlidersHorizontalIcon className="size-4" />
          Categories &amp; limits
        </Button>
        <Button variant="outline" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>

      <ManageCategoriesModal open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </div>
  );
}

export default HomePage;
