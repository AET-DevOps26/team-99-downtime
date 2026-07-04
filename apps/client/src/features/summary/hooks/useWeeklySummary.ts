import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getLatestSummary, generateSummary, type WeeklySummary } from '../api/summaryApi';

export function useWeeklySummary() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setSummary(await getLatestSummary());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const fresh = await generateSummary();
      if (fresh) {
        setSummary(fresh);
      } else {
        toast.info('Not enough expenses this week for a summary yet — track a few more first.');
      }
    } catch {
      toast.error('Could not generate the summary');
    } finally {
      setGenerating(false);
    }
  }, []);

  return { summary, loading, error, generating, generate };
}
