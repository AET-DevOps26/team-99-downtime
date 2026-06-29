import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getBudgetStatus, type CategoryStatus } from '../api/budgetApi';

export function useBudgetStatus() {
  const [categories, setCategories] = useState<CategoryStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getBudgetStatus();
      setCategories(data);
    } catch {
      setError(true);
      toast.error('Could not load budget status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRemaining = categories.reduce((sum, c) => sum + c.remaining, 0);

  return { categories, totalRemaining, loading, error, reload: load };
}
