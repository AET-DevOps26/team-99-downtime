import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { listTransactions, type Transaction } from '../api/transactionApi';

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

  return { transactions, loading, error, page, setPage, totalPages, refresh };
}
