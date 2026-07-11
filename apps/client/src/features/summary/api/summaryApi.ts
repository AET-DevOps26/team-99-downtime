import { apiClient } from '@/shared/api/client';
import type { components } from '@/shared/api/generated/genai-service';
import { apiErrorInfo, unwrap } from '@/shared/lib/api';

/**
 * api: thin wrappers over the weekly AI summary endpoints (US-11), built on
 * the shared typed apiClient — URL, method and body of every call are
 * compile-checked against the committed OpenAPI specs (regenerate with
 * `bun run openapi`). Two services cooperate: transaction-service owns the
 * week's numbers (weekly-report) and genai-service turns them into prose and
 * stores the result. No React, no UI here.
 */

export type WeeklySummary = components['schemas']['SummaryResponse'];

type WeeklyData = components['schemas']['WeeklyData'];

/** The latest stored summary, or null before the first one exists (404 NO_SUMMARY). */
export async function getLatestSummary(): Promise<WeeklySummary | null> {
  try {
    return unwrap(await apiClient.GET('/api/genai/summarize/latest'));
  } catch (err) {
    if (apiErrorInfo(err)?.status === 404) return null;
    throw err;
  }
}

/**
 * Generate (or regenerate) this week's summary: fetch the week's numbers from
 * transaction-service, then have genai-service summarize and store them.
 * Returns null when the week is too sparse to summarize (422 NOT_ENOUGH_DATA) —
 * by design no summary is stored then.
 */
export async function generateSummary(): Promise<WeeklySummary | null> {
  // weekly-report produces the summarize payload verbatim; springdoc types its
  // fields optional (no @NonNull on the record) while FastAPI requires them,
  // so re-shape at the boundary like the other feature APIs do.
  const report = unwrap(
    await apiClient.GET('/api/transactions/weekly-report')
  ) as unknown as WeeklyData;
  try {
    return unwrap(await apiClient.POST('/api/genai/summarize', { body: report }));
  } catch (err) {
    const info = apiErrorInfo(err);
    if (info?.status === 422 && info.code === 'NOT_ENOUGH_DATA') return null;
    throw err;
  }
}
