import { act, renderHook, waitFor } from '@testing-library/react';

import { useTransactions } from './useTransactions';
import * as api from '../api/transactionApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const page = (content: api.Transaction[]): api.TransactionPage => ({
  content,
  totalPages: 1,
  totalElements: content.length,
  number: 0,
  size: 20,
});

const tx = (id: string): api.Transaction => ({
  id,
  categoryId: 'cat-1',
  amount: 5,
  currency: 'EUR',
  description: `Expense ${id}`,
  date: '2026-06-15',
  createdAt: '2026-06-15T12:00:00',
});

describe('useTransactions.deleteOptimistic', () => {
  afterEach(() => vi.restoreAllMocks());

  it('removes the row immediately and keeps it removed on success', async () => {
    // Initial load has both rows; the post-delete reconcile reload returns only b.
    vi.spyOn(api, 'listTransactions')
      .mockResolvedValueOnce(page([tx('a'), tx('b')]))
      .mockResolvedValue(page([tx('b')]));
    vi.spyOn(api, 'deleteTransaction').mockResolvedValue(undefined);

    const { result } = renderHook(() => useTransactions(20));
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    await act(async () => {
      await result.current.deleteOptimistic('a');
    });

    expect(api.deleteTransaction).toHaveBeenCalledWith('a');
    await waitFor(() =>
      expect(result.current.transactions.find((t) => t.id === 'a')).toBeUndefined()
    );
  });

  it('restores the row when the server rejects the delete', async () => {
    vi.spyOn(api, 'listTransactions').mockResolvedValue(page([tx('a'), tx('b')]));
    vi.spyOn(api, 'deleteTransaction').mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useTransactions(20));
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    await act(async () => {
      await result.current.deleteOptimistic('a');
    });

    expect(result.current.transactions.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });
});
