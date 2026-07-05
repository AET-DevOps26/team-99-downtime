import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { AddExpenseModal } from './AddExpenseModal';
import {
  createTransaction,
  createTransactionsFromText,
  importTransactionsFile,
  type ImportResult,
  type Transaction,
} from '../api/transactionApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api/transactionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/transactionApi')>()),
  createTransaction: vi.fn(),
  createTransactionsFromText: vi.fn(),
  importTransactionsFile: vi.fn(),
}));
vi.mock('./CategoryPicker', () => ({
  CategoryPicker: ({ onChange }: { onChange?: (categoryId: string) => void }) => (
    <button type="button" onClick={() => onChange?.('cat-food')}>
      Pick food
    </button>
  ),
}));

const mockCreate = vi.mocked(createTransaction);
const mockCreateFromText = vi.mocked(createTransactionsFromText);
const mockImportFile = vi.mocked(importTransactionsFile);

const tx: Transaction = {
  id: 'tx-1',
  categoryId: 'cat-food',
  amount: 12.3,
  currency: 'EUR',
  description: 'Lunch at Mensa',
  date: '2026-07-03',
  createdAt: '2026-07-03T12:00:00',
};

function renderModal() {
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  render(<AddExpenseModal open onOpenChange={onOpenChange} onCreated={onCreated} />);
  return { onOpenChange, onCreated };
}

function selectTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

describe('AddExpenseModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a manual expense, closes the modal, and refreshes callers', async () => {
    mockCreate.mockResolvedValue(tx);
    const { onOpenChange, onCreated } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Pick food' }));
    fireEvent.change(screen.getByLabelText('Amount (€)'), { target: { value: '12.30' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Lunch at Mensa' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        categoryId: 'cat-food',
        amount: 12.3,
        currency: 'EUR',
        description: 'Lunch at Mensa',
        date: '2026-07-03',
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Expense added'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('rejects incomplete manual input before calling the API', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(toast.error).toHaveBeenCalledWith('Fill in all fields');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates expenses from free text and reports the created count', async () => {
    mockCreateFromText.mockResolvedValue([tx, { ...tx, id: 'tx-2' }]);
    const { onOpenChange, onCreated } = renderModal();

    selectTab(/free text/i);
    fireEvent.change(screen.getByLabelText('Describe your expenses'), {
      target: { value: 'Lunch 12.30 and coffee 3.50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    await waitFor(() =>
      expect(mockCreateFromText).toHaveBeenCalledWith('Lunch 12.30 and coffee 3.50')
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('2 expenses added'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('imports a file and shows the imported/skipped summary', async () => {
    const result: ImportResult = {
      imported: [tx],
      skipped: [{ row: 4, reason: 'Missing amount' }],
    };
    mockImportFile.mockResolvedValue(result);
    const { onCreated } = renderModal();
    const file = new File(['Lunch,12.30'], 'expenses.csv', { type: 'text/csv' });

    selectTab(/import file/i);
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('Expected file input to be rendered');
    fireEvent.change(input, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(mockImportFile).toHaveBeenCalledWith(file));
    await waitFor(() => expect(screen.getByText('1 imported, 1 skipped')).toBeTruthy());
    expect(screen.getByText('Row 4: Missing amount')).toBeTruthy();
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
});
