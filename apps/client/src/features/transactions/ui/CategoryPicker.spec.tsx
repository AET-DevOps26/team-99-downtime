import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CategoryPicker } from './CategoryPicker';
import { listCategories, type Category } from '@/features/budgets/api/budgetApi';

vi.mock('@/features/budgets/api/budgetApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/budgets/api/budgetApi')>()),
  listCategories: vi.fn(),
}));
vi.mock('@/shared/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="Category"
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    const text = Array.isArray(children)
      ? children.filter((child) => typeof child === 'string').join('')
      : typeof children === 'string'
        ? children
        : value;
    return <option value={value}>{text}</option>;
  },
}));

const mockListCategories = vi.mocked(listCategories);

const categories: Category[] = [
  { id: 'cat-food', name: 'Food', monthlyLimit: 300 },
  { id: 'cat-rent', name: 'Rent', monthlyLimit: 900 },
];

describe('CategoryPicker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads categories and emits the selected category id', async () => {
    mockListCategories.mockResolvedValue(categories);
    const onChange = vi.fn();

    render(<CategoryPicker value="" onChange={onChange} />);

    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'cat-food' } });

    expect(onChange).toHaveBeenCalledWith('cat-food');
  });

  it('shows a disabled error state when categories cannot be loaded', async () => {
    mockListCategories.mockRejectedValue(new Error('offline'));

    render(<CategoryPicker />);

    await waitFor(() => expect(screen.getByText('Could not load categories')).toBeTruthy());
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
  });
});
