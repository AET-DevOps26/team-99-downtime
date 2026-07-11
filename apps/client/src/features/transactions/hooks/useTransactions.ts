import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { deleteTransaction, listTransactions, type Transaction } from '../api/transactionApi';

export function useTransactions(pageSize = 20) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Live mirror of `page` for async handlers: a delete that resolves after the
  // user has paged away can compare against this to tell it's on a stale page.
  const pageRef = useRef(page);
  pageRef.current = page;

  const load = useCallback(
    async (p: number, signal?: AbortSignal) => {
      if (signal?.aborted) return;
      setLoading(true);
      setError(false);
      try {
        const result = await listTransactions(p, pageSize, signal);
        if (signal?.aborted) return;
        setTransactions(result.content);
        setTotalPages(result.totalPages);
      } catch {
        // A cancelled request belongs to an obsolete render; its replacement
        // or the route unmount owns the visible state now.
        if (signal?.aborted) return;
        setError(true);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(page, controller.signal);
    return () => controller.abort();
  }, [page, load]);

  const refresh = useCallback(() => load(page), [load, page]);

  /**
   * Removes a transaction optimistically, then reconciles against the server.
   * Decisions use the live page (pageRef) and the reload response — never
   * call-time closures — so a delete resolving after the user paged away won't
   * yank them back or restore stale rows. Emptying a non-first page steps back.
   */
  const deleteOptimistic = useCallback(
    async (id: string) => {
      const startPage = pageRef.current;
      setTransactions((txs) => txs.filter((t) => t.id !== id));
      try {
        await deleteTransaction(id);
        toast.success('Expense deleted');
      } catch {
        toast.error('Could not delete expense');
      }
      // Bow out if the user navigated mid-flight — their own load() owns state now.
      if (pageRef.current !== startPage) return;
      const result = await listTransactions(startPage, pageSize).catch(() => null);
      if (!result || pageRef.current !== startPage) return;
      if (result.content.length === 0 && startPage > 0) {
        setPage((p) => p - 1);
      } else {
        setTransactions(result.content);
        setTotalPages(result.totalPages);
      }
    },
    [pageSize]
  );

  return { transactions, loading, error, page, setPage, totalPages, refresh, deleteOptimistic };
}
