import { LogOutIcon } from 'lucide-react';

import { useSession, useLogout } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';
import { Button } from '@/shared/ui/button';

export function Header() {
  const { data } = useSession();
  const logout = useLogout();
  const user = data?.user;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <span className="text-sm font-medium text-muted-foreground">ExpenseFlow</span>

      <div className="flex items-center gap-3">
        <NotificationBell />

        {user && (
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void logout()}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOutIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
