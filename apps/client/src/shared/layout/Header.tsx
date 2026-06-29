import { NotificationBell } from '@/features/notifications';

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <span className="text-sm font-medium text-muted-foreground">ExpenseFlow</span>
      <NotificationBell />
    </header>
  );
}

export default Header;
