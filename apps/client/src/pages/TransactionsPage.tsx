import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Skeleton } from '@/shared/ui/skeleton';
import { listCategories } from '@/features/budgets/api/budgetApi';
import {
  AddExpenseModal,
  DeleteExpenseDialog,
  EditExpenseModal,
  useTransactions,
  type Transaction,
} from '@/features/transactions';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

type RowAction = 'edit' | 'delete';

export function TransactionsPage() {
  const { transactions, loading, error, page, setPage, totalPages, refresh, deleteOptimistic } =
    useTransactions(20);
  const [addOpen, setAddOpen] = useState(false);
  const [action, setAction] = useState<RowAction | null>(null);
  const [actionTx, setActionTx] = useState<Transaction | null>(null);
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    listCategories()
      .then((cats) => setCategoryNames(new Map(cats.map((c) => [c.id, c.name]))))
      .catch(() => {
        toast.error('Could not load categories');
        setCategoryNames(new Map());
      });
  }, []);

  const openAction = (a: RowAction, tx: Transaction) => {
    setActionTx(tx);
    setAction(a);
  };

  const closeAction = (open: boolean) => {
    if (!open) setAction(null);
  };

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
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
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
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                  <TableCell>
                    <Badge variant="secondary">
                      {categoryNames.get(tx.categoryId) ?? 'Uncategorized'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{euro.format(tx.amount)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${tx.description}`}
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openAction('edit', tx)}>
                          <PencilIcon /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => openAction('delete', tx)}
                        >
                          <Trash2Icon /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
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
      <EditExpenseModal
        transaction={actionTx}
        open={action === 'edit'}
        onOpenChange={closeAction}
        onSaved={refresh}
      />
      <DeleteExpenseDialog
        transaction={actionTx}
        open={action === 'delete'}
        onOpenChange={closeAction}
        onConfirm={() => actionTx && void deleteOptimistic(actionTx.id)}
      />
    </div>
  );
}

export default TransactionsPage;
