import type { components as genai } from '@/shared/api/generated/genai-service';
import type { components as transactions } from '@/shared/api/generated/transaction-service';
import { apiFetch, apiErrorInfo } from '@/shared/lib/api';

/**
 * api: thin wrappers over the weekly AI summary endpoints (US-11). Two services
 * cooperate: transaction-service owns the week's numbers (weekly-report) and
 * genai-service turns them into prose and stores the result. No React, no UI here.
 *
 * The request/response shapes are the auto-generated OpenAPI types
 * (apps/client/src/shared/api/generated, produced by `bun run openapi`), so they
 * track the backend contract instead of being hand-maintained here.
 */

export type WeeklySummary = genai['schemas']['SummaryResponse'];

/** The genai summarize payload, produced verbatim by GET /api/transactions/weekly-report. */
type WeeklyReport = transactions['schemas']['WeeklyReport'];

/** The latest stored summary, or null before the first one exists (404 NO_SUMMARY). */
export async function getLatestSummary(): Promise<WeeklySummary | null> {
  try {
    return await apiFetch<WeeklySummary>('/api/genai/summarize/latest');
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
  const report = await apiFetch<WeeklyReport>('/api/transactions/weekly-report');
  try {
    return await apiFetch<WeeklySummary>('/api/genai/summarize', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  } catch (err) {
    if (apiErrorInfo(err)?.status === 422) return null;
    throw err;
  }
}
