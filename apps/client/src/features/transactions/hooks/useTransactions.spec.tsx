import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { useTransactions } from './useTransactions';
import * as api from '../api/transactionApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const page = (content: api.Transaction[]): api.TransactionPage => ({
  content,
  empty: content.length === 0,
  first: true,
  last: true,
  numberOfElements: content.length,
  pageable: {
    offset: 0,
    pageNumber: 0,
    pageSize: 20,
    paged: true,
    sort: { empty: true, sorted: false, unsorted: true },
    unpaged: false,
  },
  sort: { empty: true, sorted: false, unsorted: true },
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

describe('useTransactions.load', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('aborts the active page load when the hook unmounts', async () => {
    let loadSignal: AbortSignal | undefined;
    vi.spyOn(api, 'listTransactions').mockImplementation((_page, _size, signal) => {
      loadSignal = signal;
      return new Promise<api.TransactionPage>(() => undefined);
    });

    const { unmount } = renderHook(() => useTransactions(20));
    await waitFor(() => expect(loadSignal).toBeDefined());

    unmount();

    expect(loadSignal?.aborted).toBe(true);
  });

  it('exposes other load failures inline without also showing a toast', async () => {
    vi.spyOn(api, 'listTransactions').mockRejectedValue(new Error('unavailable'));

    const { result } = renderHook(() => useTransactions(20));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('useTransactions.deleteOptimistic', () => {
  beforeEach(() => vi.clearAllMocks());
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
    expect(toast.success).toHaveBeenCalledWith('Expense deleted');
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
    expect(toast.error).toHaveBeenCalledWith('Could not delete expense');
  });

  it('does not reconcile the page the user paged away from mid-delete', async () => {
    let resolveDelete!: () => void;
    const pending = new Promise<void>((r) => (resolveDelete = r));
    vi.spyOn(api, 'listTransactions').mockResolvedValue(page([tx('a'), tx('b')]));
    vi.spyOn(api, 'deleteTransaction').mockReturnValue(pending);

    const { result } = renderHook(() => useTransactions(20));
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    // Start a delete on page 0, then navigate to page 1 before it resolves.
    let done!: Promise<void>;
    act(() => {
      done = result.current.deleteOptimistic('a');
    });
    act(() => result.current.setPage(1));

    await act(async () => {
      resolveDelete();
      await done;
    });

    // The delete resolving must not yank the user back to page 0.
    expect(result.current.page).toBe(1);
  });
});
