import { cn } from '@/shared/lib/utils';

interface WordmarkProps {
  className?: string;
}

/**
 * The ExpenseFlow wordmark: "expense" in the foreground, "flow" muted.
 * Presentation only — no logic, no data.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={cn('text-xl font-semibold tracking-tight lowercase', className)}>
      expense<span className="font-normal text-muted-foreground">flow</span>
    </span>
  );
}
