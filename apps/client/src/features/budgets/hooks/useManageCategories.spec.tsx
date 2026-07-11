import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { useManageCategories } from './useManageCategories';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from '../api/budgetApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../api/budgetApi', () => ({
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listCategories: vi.fn(),
  updateCategory: vi.fn(),
}));

const mockCreateCategory = vi.mocked(createCategory);
const mockDeleteCategory = vi.mocked(deleteCategory);
const mockListCategories = vi.mocked(listCategories);
const mockUpdateCategory = vi.mocked(updateCategory);

const category: Category = { id: 'cat-food', name: 'Food', monthlyLimit: 300 };

describe('useManageCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCategories.mockResolvedValue([]);
    mockCreateCategory.mockResolvedValue(category);
    mockDeleteCategory.mockResolvedValue(undefined);
    mockUpdateCategory.mockResolvedValue(category);
  });

  it('reports validation failures inline without also showing a toast', async () => {
    const { result } = renderHook(() => useManageCategories(true, vi.fn()));
    await waitFor(() => expect(mockListCategories).toHaveBeenCalledTimes(1));

    act(() => result.current.addRow());
    await act(async () => result.current.save());

    expect(result.current.rows[0].error).toBe('Name is required');
    expect(toast.error).not.toHaveBeenCalled();
    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it('keeps row save failures inline without also showing a toast', async () => {
    mockCreateCategory.mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(() => useManageCategories(true, vi.fn()));
    await waitFor(() => expect(mockListCategories).toHaveBeenCalledTimes(1));

    act(() => result.current.addRow());
    const key = result.current.rows[0].key;
    act(() => {
      result.current.setName(key, 'Food');
      result.current.setLimit(key, '300');
    });
    await act(async () => result.current.save());

    expect(result.current.rows[0].error).toBe('Could not save this category');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('keeps a toast for delete failures that have no inline row', async () => {
    mockListCategories.mockResolvedValue([category]);
    mockDeleteCategory.mockRejectedValue(new Error('unavailable'));
    const onOpenChange = vi.fn();
    const { result } = renderHook(() => useManageCategories(true, onOpenChange));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => result.current.removeRow(result.current.rows[0].key));
    await act(async () => result.current.save());

    expect(mockDeleteCategory).toHaveBeenCalledWith(category.id);
    expect(toast.error).toHaveBeenCalledWith('Some categories could not be deleted');
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
