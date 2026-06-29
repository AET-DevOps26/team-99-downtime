import type { ReactNode } from 'react';

interface HeaderProps {
  actions?: ReactNode;
}

export function Header({ actions }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <span className="text-sm font-medium text-muted-foreground">ExpenseFlow</span>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}

export default Header;
