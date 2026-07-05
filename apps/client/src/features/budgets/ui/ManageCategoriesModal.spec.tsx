import { fireEvent, render, screen } from '@testing-library/react';

import { ManageCategoriesModal } from './ManageCategoriesModal';
import { useManageCategories, type CategoryRow } from '../hooks/useManageCategories';

vi.mock('../hooks/useManageCategories', () => ({
  useManageCategories: vi.fn(),
}));

const mockUseManageCategories = vi.mocked(useManageCategories);

const baseRows: CategoryRow[] = [
  {
    key: 'row-food',
    id: 'cat-food',
    name: 'Food',
    monthlyLimit: '300',
  },
  {
    key: 'row-rent',
    id: 'cat-rent',
    name: 'Rent',
    monthlyLimit: '900',
    error: 'Monthly limit must be positive',
  },
];

function arrange(rows = baseRows) {
  const handlers = {
    setName: vi.fn(),
    setLimit: vi.fn(),
    addRow: vi.fn(),
    removeRow: vi.fn(),
    save: vi.fn(),
  };
  mockUseManageCategories.mockReturnValue({
    rows,
    loading: false,
    saving: false,
    count: rows.length,
    totalLabel: '1.200,00 €',
    ...handlers,
  });

  const onOpenChange = vi.fn();
  render(<ManageCategoriesModal open onOpenChange={onOpenChange} />);
  return { handlers, onOpenChange };
}

describe('ManageCategoriesModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders editable category rows with totals and inline errors', () => {
    arrange();

    expect(screen.getByDisplayValue('Food')).toBeTruthy();
    expect(screen.getByDisplayValue('900')).toBeTruthy();
    expect(screen.getByText('Monthly limit must be positive')).toBeTruthy();
    expect(screen.getByText('2 categories · 1.200,00 € total budget')).toBeTruthy();
  });

  it('wires edits, row actions, save, and cancel to the category manager', () => {
    const { handlers, onOpenChange } = arrange();

    fireEvent.change(screen.getByDisplayValue('Food'), { target: { value: 'Groceries' } });
    fireEvent.change(screen.getByDisplayValue('300'), { target: { value: '350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(handlers.setName).toHaveBeenCalledWith('row-food', 'Groceries');
    expect(handlers.setLimit).toHaveBeenCalledWith('row-food', '350');
    expect(handlers.addRow).toHaveBeenCalledTimes(1);
    expect(handlers.removeRow).toHaveBeenCalledWith('row-rent');
    expect(handlers.save).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
