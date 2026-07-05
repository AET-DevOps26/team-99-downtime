import { RefreshCwIcon, SparklesIcon, WandSparklesIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import type { WeeklySummary } from '../api/summaryApi';

interface WeeklySummaryCardProps {
  summary: WeeklySummary | null;
  loading: boolean;
  error: boolean;
  generating: boolean;
  onGenerate: () => void;
  onRetry: () => void;
}

const weekLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
};

const updatedLabel = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export function WeeklySummaryCard({
  summary,
  loading,
  error,
  generating,
  onGenerate,
  onRetry,
}: WeeklySummaryCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {/* Soft AI-tinted wash; opacity-based so it works on any card background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/5"
      />
      <CardHeader className="relative flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <SparklesIcon className="size-3.5" />
          </span>
          Weekly AI summary
        </CardTitle>
        {summary && !loading && !error && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Regenerate summary"
            disabled={generating}
            onClick={onGenerate}
          >
            <RefreshCwIcon className={cn('size-3.5', generating && 'animate-spin')} />
          </Button>
        )}
      </CardHeader>
      <CardContent className="relative">
        {error ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">Could not load the weekly summary.</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground"
              onClick={onRetry}
            >
              <RefreshCwIcon className="size-3.5" />
              Try again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : summary ? (
          <>
            <p className="text-sm leading-relaxed">{summary.summary}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Week of {weekLabel(summary.weekStart)} · Updated {updatedLabel(summary.generatedAt)}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <WandSparklesIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">No summary yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every Sunday evening the AI sums up your week — or get this week&apos;s insights
                now.
              </p>
            </div>
            <Button size="sm" disabled={generating} onClick={onGenerate}>
              {generating ? (
                <RefreshCwIcon className="size-4 animate-spin" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              {generating ? 'Generating…' : 'Generate now'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
