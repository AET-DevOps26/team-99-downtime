// Public API for the weekly AI summary feature (US-11) — import from here, not
// from internal files. Data comes from genai-service (latest/generate) with the
// week's numbers supplied by transaction-service's weekly-report endpoint.
export { WeeklySummaryCard } from './ui/WeeklySummaryCard';
export { useWeeklySummary } from './hooks/useWeeklySummary';
export type { WeeklySummary } from './api/summaryApi';
