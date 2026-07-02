import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { deleteTransaction, listTransactions, type Transaction } from '../api/transactionApi';

export function useTransactions(pageSize = 20) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(false);
      try {
        const result = await listTransactions(p, pageSize);
        setTransactions(result.content);
        setTotalPages(result.totalPages);
      } catch {
        setError(true);
        toast.error('Could not load transactions');
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    void load(page);
  }, [page, load]);

  const refresh = useCallback(() => load(page), [load, page]);

  /** Removes a transaction optimistically, restoring it if the delete fails. */
  const deleteOptimistic = useCallback(
    async (id: string) => {
      const previous = transactions;
      setTransactions((txs) => txs.filter((t) => t.id !== id));
      try {
        await deleteTransaction(id);
        toast.success('Expense deleted');
        // Emptied a non-first page? Step back; otherwise reload to fix counts.
        if (previous.length === 1 && page > 0) {
          setPage((p) => p - 1);
        } else {
          void load(page);
        }
      } catch {
        setTransactions(previous);
        toast.error('Could not delete expense');
      }
    },
    [transactions, page, load]
  );

  return { transactions, loading, error, page, setPage, totalPages, refresh, deleteOptimistic };
}
