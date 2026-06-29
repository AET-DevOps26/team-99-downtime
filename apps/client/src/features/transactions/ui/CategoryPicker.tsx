import { useEffect, useState } from 'react';
import { listCategories, type Category } from '@/features/budgets/api/budgetApi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

interface CategoryPickerProps {
  value?: string;
  onChange?: (categoryId: string) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select category" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default CategoryPicker;
