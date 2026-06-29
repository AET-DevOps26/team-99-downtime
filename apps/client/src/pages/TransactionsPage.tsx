import { useState } from 'react';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Skeleton } from '@/shared/ui/skeleton';
import { AddExpenseModal, useTransactions } from '@/features/transactions';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function TransactionsPage() {
  const { transactions, loading, error, page, setPage, totalPages, refresh } = useTransactions(20);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon className="size-4" />
          Add expense
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">Could not load transactions. Try refreshing.</p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No transactions yet. Add your first expense.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {dateLabel(tx.date)}
                  </TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className="text-right font-medium">{euro.format(tx.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}

      <AddExpenseModal open={addOpen} onOpenChange={setAddOpen} onCreated={refresh} />
    </div>
  );
}

export default TransactionsPage;
