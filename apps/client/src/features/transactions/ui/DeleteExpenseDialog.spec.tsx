import { fireEvent, render, screen } from '@testing-library/react';

import { DeleteExpenseDialog } from './DeleteExpenseDialog';
import type { Transaction } from '../api/transactionApi';

const tx: Transaction = {
  id: 'tx-1',
  categoryId: 'cat-1',
  amount: 8.5,
  currency: 'EUR',
  description: 'Lunch at Mensa',
  date: '2026-06-15',
  createdAt: '2026-06-15T12:00:00',
};

describe('DeleteExpenseDialog', () => {
  it('confirms the delete and closes when Delete is clicked', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DeleteExpenseDialog
        transaction={tx}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    // The row being deleted is named so the user knows what they're removing.
    expect(screen.getByText(/Lunch at Mensa/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('leaves the transaction untouched when Cancel is clicked', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DeleteExpenseDialog
        transaction={tx}
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
