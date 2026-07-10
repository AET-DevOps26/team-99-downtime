import { apiClient } from '@/shared/api/client';
import { ApiError } from '@/shared/lib/api';
import { generateSummary } from './summaryApi';

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

const report = {
  weekStart: '2026-06-29',
  thisWeek: [
    {
      date: '2026-07-01',
      amount: 12.5,
      currency: 'EUR',
      description: 'Lunch',
    },
  ],
  lastWeek: { total: 20, count: 2 },
};

const result = (status: number, body: unknown) => ({
  error: body,
  response: new Response(null, { status }),
});

describe('generateSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: report,
      response: new Response(null, { status: 200 }),
    } as never);
  });

  it('returns null for the explicit NOT_ENOUGH_DATA contract', async () => {
    vi.mocked(apiClient.POST).mockResolvedValue(
      result(422, { detail: 'NOT_ENOUGH_DATA' }) as never
    );

    await expect(generateSummary()).resolves.toBeNull();
  });

  it('rethrows unrelated validation errors instead of reporting sparse data', async () => {
    const detail = [{ loc: ['body', 'weekStart'], msg: 'Field required', type: 'missing' }];
    vi.mocked(apiClient.POST).mockResolvedValue(result(422, { detail }) as never);

    await expect(generateSummary()).rejects.toEqual(
      new ApiError(422, {
        detail,
      })
    );
  });

  it('rethrows LLM_UNAVAILABLE for the hook to classify', async () => {
    vi.mocked(apiClient.POST).mockResolvedValue(
      result(502, { detail: 'LLM_UNAVAILABLE' }) as never
    );

    await expect(generateSummary()).rejects.toEqual(
      new ApiError(502, { detail: 'LLM_UNAVAILABLE' })
    );
  });
});
