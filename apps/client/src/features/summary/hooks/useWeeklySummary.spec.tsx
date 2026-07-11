import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { ApiError } from '@/shared/lib/api';
import * as api from '../api/summaryApi';
import { useWeeklySummary } from './useWeeklySummary';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useWeeklySummary.generate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(api, 'getLatestSummary').mockResolvedValue(null);
  });

  const renderLoadedHook = async () => {
    const hook = renderHook(() => useWeeklySummary());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  };

  it('shows a distinct message when the AI service is unavailable', async () => {
    vi.spyOn(api, 'generateSummary').mockRejectedValue(
      new ApiError(502, { detail: 'LLM_UNAVAILABLE' })
    );
    const { result } = await renderLoadedHook();

    await act(async () => {
      await result.current.generate();
    });

    expect(toast.error).toHaveBeenCalledWith(
      'The AI service is temporarily unavailable — please try again later.'
    );
    expect(toast.info).not.toHaveBeenCalled();
    expect(result.current.generating).toBe(false);
  });

  it('shows the sparse-data message only when the API returns null', async () => {
    vi.spyOn(api, 'generateSummary').mockResolvedValue(null);
    const { result } = await renderLoadedHook();

    await act(async () => {
      await result.current.generate();
    });

    expect(toast.info).toHaveBeenCalledWith(
      'Not enough expenses this week for a summary yet — track a few more first.'
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.generating).toBe(false);
  });

  it('keeps the generic message for other generation failures', async () => {
    vi.spyOn(api, 'generateSummary').mockRejectedValue(
      new ApiError(502, { detail: 'UPSTREAM_UNAVAILABLE' })
    );
    const { result } = await renderLoadedHook();

    await act(async () => {
      await result.current.generate();
    });

    expect(toast.error).toHaveBeenCalledWith('Could not generate the summary');
    expect(toast.info).not.toHaveBeenCalled();
    expect(result.current.generating).toBe(false);
  });
});
