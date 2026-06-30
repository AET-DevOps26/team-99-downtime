import { NavLink } from 'react-router';
import { LayoutDashboardIcon, ReceiptIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';

import { Wordmark } from '@/shared/ui/wordmark';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { ManageCategoriesModal } from '@/features/budgets';

export function Sidebar() {
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <>
      <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-background px-3 py-4">
        <div className="mb-6 px-2">
          <Wordmark />
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <LayoutDashboardIcon className="size-4" />
            Dashboard
          </NavLink>

          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <ReceiptIcon className="size-4" />
            Transactions
          </NavLink>
        </nav>

        <Button
          variant="outline"
          size="sm"
          className="mt-auto w-full justify-start gap-2 text-muted-foreground"
          onClick={() => setCategoriesOpen(true)}
        >
          <SlidersHorizontalIcon className="size-4" />
          Manage categories
        </Button>
      </aside>

      <ManageCategoriesModal open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </>
  );
}

export default Sidebar;
