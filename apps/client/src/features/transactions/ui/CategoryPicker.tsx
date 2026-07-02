import { useEffect, useState } from 'react';
import { listCategories, type Category } from '@/features/budgets/api/budgetApi';
import { iconFor } from '@/features/budgets/lib/categoryIcons';
import { cn } from '@/shared/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

interface CategoryPickerProps {
  id?: string;
  value?: string;
  onChange?: (categoryId: string) => void;
}

export function CategoryPicker({ id, value, onChange }: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Could not load categories" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((cat) => {
          const { Icon, className } = iconFor(cat.name);
          return (
            <SelectItem key={cat.id} value={cat.id}>
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full',
                  className
                )}
              >
                <Icon className="size-3" />
              </span>
              {cat.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default CategoryPicker;
