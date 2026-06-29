import { SlidersHorizontalIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { iconFor, type CategoryStatus } from '@/features/budgets';

interface BudgetBarsProps {
  categories: CategoryStatus[];
  totalRemaining: number;
  loading: boolean;
  error: boolean;
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function BudgetBars({ categories, totalRemaining, loading, error }: BudgetBarsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
          Budget this month
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">Could not load budget status.</p>
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {categories.map((cat) => {
                const pct = Math.min(cat.percentUsed, 100);
                const isAlert = cat.percentUsed >= 80;
                const { Icon, className: iconCn } = iconFor(cat.name);
                return (
                  <div key={cat.categoryId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-md',
                            iconCn
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="font-medium">{cat.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {euro.format(cat.spent)} / {euro.format(cat.monthlyLimit)}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className={cn(isAlert && '[&>[data-slot=progress-indicator]]:bg-destructive')}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total remaining</span>
                <span
                  className={cn(
                    'font-semibold',
                    totalRemaining < 0 ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {euro.format(totalRemaining)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
