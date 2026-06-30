import { useBudgetStatus } from '@/features/budgets';
import { useTransactions } from '@/features/transactions';
import { RecentTransactions, BudgetBars } from '@/features/dashboard';

export function DashboardPage() {
  const {
    categories,
    totalRemaining,
    loading: budgetLoading,
    error: budgetError,
  } = useBudgetStatus();
  const { transactions, loading: txLoading, error: txError } = useTransactions(5);

  return (
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
  );
}

export default DashboardPage;
