import { Loader2Icon, PlusIcon, SlidersHorizontalIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

import { iconFor } from '../lib/categoryIcons';
import { useManageCategories } from '../hooks/useManageCategories';

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "Budget categories" modal (US-1). Pure presentation: every piece of state
 * and behaviour comes from {@link useManageCategories}; this component only
 * draws rows and wires events to the handlers it returns.
 */
export function ManageCategoriesModal({ open, onOpenChange }: ManageCategoriesModalProps) {
  const { rows, loading, saving, count, totalLabel, setName, setLimit, addRow, removeRow, save } =
    useManageCategories(open, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontalIcon className="size-5 text-muted-foreground" />
            Budget categories
          </DialogTitle>
          <DialogDescription>
            Define the categories the AI sorts transactions into, and the monthly limit for each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_9rem_2.5rem] gap-3 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span>Category</span>
            <span>Monthly limit</span>
            <span className="sr-only">Remove</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const { Icon, className } = iconFor(row.name);
                return (
                  <div key={row.key}>
                    <div className="grid grid-cols-[1fr_9rem_2.5rem] items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg',
                            className
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <Input
                          value={row.name}
                          onChange={(e) => setName(row.key, e.target.value)}
                          placeholder="Category name"
                          aria-invalid={Boolean(row.error)}
                        />
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          €
                        </span>
                        <Input
                          value={row.monthlyLimit}
                          onChange={(e) => setLimit(row.key, e.target.value)}
                          inputMode="decimal"
                          placeholder="0"
                          className="pl-7"
                          aria-invalid={Boolean(row.error)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.key)}
                        aria-label={`Remove ${row.name || 'category'}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                    {row.error && (
                      <p className="mt-1 pl-11 text-xs text-destructive">{row.error}</p>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={addRow}
                className="w-full border-dashed text-muted-foreground"
              >
                <PlusIcon className="size-4" />
                Add category
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {count} categories · {totalLabel} total budget
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || loading}>
              {saving && <Loader2Icon className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ManageCategoriesModal;
