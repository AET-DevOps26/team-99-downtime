import { ReceiptIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import type { Transaction } from '@/features/transactions';
import type { CategoryStatus } from '@/features/budgets';

interface RecentTransactionsProps {
  transactions: Transaction[];
  categories: CategoryStatus[];
  loading: boolean;
  error: boolean;
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
  });

export function RecentTransactions({
  transactions,
  categories,
  loading,
  error,
}: RecentTransactionsProps) {
  const categoryName = (id: string) =>
    categories.find((c) => c.categoryId === id)?.name ?? 'Unknown';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptIcon className="size-4 text-muted-foreground" />
          Recent transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">Could not load transactions.</p>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No transactions yet. Add your first expense on the Transactions page.
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium leading-none">{tx.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {categoryName(tx.categoryId)} · {dateLabel(tx.date)}
                  </p>
                </div>
                <span className="text-sm font-medium">{euro.format(tx.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
