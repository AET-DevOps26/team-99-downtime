import { act, render, screen } from '@testing-library/react';

import { TransactionsPage } from './TransactionsPage';
import type { Transaction } from '@/features/transactions';

const useTransactionsMock = vi.fn();

vi.mock('@/features/transactions', () => ({
  useTransactions: (pageSize: number) => useTransactionsMock(pageSize),
  AddExpenseModal: () => null,
  EditExpenseModal: () => null,
  DeleteExpenseDialog: () => null,
}));

vi.mock('@/features/budgets/api/budgetApi', () => ({
  listCategories: () =>
    Promise.resolve([{ id: 'cat-1', name: 'Groceries', monthlyLimit: 100, color: '' }]),
}));

const sampleTx: Transaction = {
  id: 'tx-1',
  categoryId: 'cat-1',
  amount: 8.5,
  currency: 'EUR',
  description: 'Lunch at Mensa',
  date: '2026-06-15',
  createdAt: '2026-06-15T12:00:00',
};

const hookState = (transactions: Transaction[]) => ({
  transactions,
  loading: false,
  error: false,
  page: 0,
  setPage: vi.fn(),
  totalPages: 1,
  refresh: vi.fn(),
  deleteOptimistic: vi.fn(),
});

describe('TransactionsPage', () => {
  it('shows the empty state when there are no transactions', async () => {
    useTransactionsMock.mockReturnValue(hookState([]));
    render(<TransactionsPage />);
    await act(async () => {}); // flush the categories fetch inside act
    expect(screen.getByText(/no transactions yet/i)).toBeTruthy();
  });

  it('renders amount, description, category and date for each transaction', async () => {
    useTransactionsMock.mockReturnValue(hookState([sampleTx]));
    render(<TransactionsPage />);

    expect(screen.getByText('Lunch at Mensa')).toBeTruthy();
    expect(screen.getByText('15.06.2026')).toBeTruthy();
    expect(screen.getByText(/8,50/)).toBeTruthy();
    expect(await screen.findByText('Groceries')).toBeTruthy();
    expect(screen.queryByText(/no transactions yet/i)).toBeNull();
  });

  it('offers a per-row actions menu', async () => {
    useTransactionsMock.mockReturnValue(hookState([sampleTx]));
    render(<TransactionsPage />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Actions for Lunch at Mensa' })).toBeTruthy();
  });
});
