import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { EditExpenseModal } from './EditExpenseModal';
import { updateTransaction, type Transaction } from '../api/transactionApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api/transactionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/transactionApi')>()),
  updateTransaction: vi.fn(),
}));
// CategoryPicker fetches categories over the network; the id comes from the
// transaction, so a stub is enough for these save/validation tests.
vi.mock('./CategoryPicker', () => ({
  CategoryPicker: () => <div data-testid="category-picker" />,
}));

const tx: Transaction = {
  id: 'tx-1',
  categoryId: 'cat-1',
  amount: 8.5,
  currency: 'EUR',
  description: 'Lunch at Mensa',
  date: '2026-06-15',
  createdAt: '2026-06-15T12:00:00',
};

const mockUpdate = vi.mocked(updateTransaction);

function renderModal() {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(<EditExpenseModal transaction={tx} open onOpenChange={onOpenChange} onSaved={onSaved} />);
  return { onOpenChange, onSaved };
}

describe('EditExpenseModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves the prefilled values, then closes and notifies on success', async () => {
    mockUpdate.mockResolvedValue({ ...tx });
    const { onOpenChange, onSaved } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'tx-1',
        expect.objectContaining({ categoryId: 'cat-1', amount: 8.5, description: 'Lunch at Mensa' })
      )
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Expense updated'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).toHaveBeenCalled();
  });

  it('rejects a non-positive amount without calling the API', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(toast.error).toHaveBeenCalledWith('Amount must be a positive number');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects empty fields without calling the API', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(toast.error).toHaveBeenCalledWith('Fill in all fields');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('shows an error toast when the update fails', async () => {
    mockUpdate.mockRejectedValue(new Error('boom'));
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not update expense'));
  });
});
