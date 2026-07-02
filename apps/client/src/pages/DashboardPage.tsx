import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { useBudgetStatus } from '@/features/budgets';
import { AddExpenseModal, useTransactions } from '@/features/transactions';
import { RecentTransactions, BudgetBars } from '@/features/dashboard';

export function DashboardPage() {
  const {
    categories,
    totalRemaining,
    loading: budgetLoading,
    error: budgetError,
    reload: reloadBudget,
  } = useBudgetStatus();
  const { transactions, loading: txLoading, error: txError, refresh } = useTransactions(5);
  const [addOpen, setAddOpen] = useState(false);

  const handleCreated = () => {
    void refresh();
    void reloadBudget();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-4" />
          Add expense
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions
          transactions={transactions}
          categories={categories}
          loading={txLoading}
          error={txError}
        />
        <BudgetBars
          categories={categories}
          totalRemaining={totalRemaining}
          loading={budgetLoading}
          error={budgetError}
        />
      </div>

      <AddExpenseModal open={addOpen} onOpenChange={setAddOpen} onCreated={handleCreated} />
    </div>
  );
}

export default DashboardPage;
