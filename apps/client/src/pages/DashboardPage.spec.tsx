import { fireEvent, render, screen } from '@testing-library/react';

import { DashboardPage } from './DashboardPage';

const refresh = vi.fn();
const reloadBudget = vi.fn();

vi.mock('@/features/transactions', () => ({
  useTransactions: () => ({
    transactions: [],
    loading: false,
    error: false,
    page: 0,
    setPage: vi.fn(),
    totalPages: 0,
    refresh,
    deleteOptimistic: vi.fn(),
  }),
  // Expose onCreated as a button so the test can fire the creation callback.
  AddExpenseModal: ({ onCreated }: { onCreated?: () => void }) => (
    <button onClick={() => onCreated?.()}>fire-created</button>
  ),
}));

vi.mock('@/features/budgets', () => ({
  useBudgetStatus: () => ({
    categories: [],
    totalRemaining: 0,
    loading: false,
    error: false,
    reload: reloadBudget,
  }),
}));

vi.mock('@/features/dashboard', () => ({
  RecentTransactions: () => null,
  BudgetBars: () => null,
}));

describe('DashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refreshes transactions and budgets when an expense is created', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByText('fire-created'));
    expect(refresh).toHaveBeenCalled();
    expect(reloadBudget).toHaveBeenCalled();
  });
});
