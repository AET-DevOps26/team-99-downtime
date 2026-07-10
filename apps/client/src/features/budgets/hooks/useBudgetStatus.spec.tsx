import { renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { useBudgetStatus } from './useBudgetStatus';
import { getBudgetStatus } from '../api/budgetApi';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../api/budgetApi', () => ({ getBudgetStatus: vi.fn() }));

const mockGetBudgetStatus = vi.mocked(getBudgetStatus);

describe('useBudgetStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes load failures inline without also showing a toast', async () => {
    mockGetBudgetStatus.mockRejectedValue(new Error('unavailable'));

    const { result } = renderHook(() => useBudgetStatus());

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
