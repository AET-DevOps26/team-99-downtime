import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ApiError, apiErrorInfo } from '@/shared/lib/api';

import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/budgetApi';
import { categorySchema } from '../schemas/categorySchemas';

/**
 * An editable row in the modal. `monthlyLimit` is kept as the raw input string
 * so partial typing ("", "1.") doesn't fight a number type; it is coerced on
 * save. A row without `id` is new (POST); `dirty` marks an existing row whose
 * fields changed (PATCH). `error` is the inline message under the row.
 */
export interface CategoryRow {
  key: string;
  id?: string;
  name: string;
  monthlyLimit: string;
  dirty?: boolean;
  error?: string;
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

function newKey() {
  return crypto.randomUUID();
}

function messageFor(error: unknown): string {
  const info = apiErrorInfo(error);
  if (info?.status === 409) return 'A category with this name already exists';
  if (info?.status === 400) {
    const first = info.fields && Object.values(info.fields)[0];
    if (first) return first;
  }
  return 'Could not save this category';
}

/**
 * hooks: the brain of the category manager. Loads the user's categories when the
 * modal opens, holds the editable rows, and on save reconciles them with the
 * backend (delete removed, create new, patch changed) — surfacing per-row
 * validation (400) and duplicate (409) errors. The modal only draws what this
 * returns.
 */
export function useManageCategories(open: boolean, onOpenChange: (open: boolean) => void) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const categories = await listCategories();
      setRows(
        categories.map((category) => ({
          key: newKey(),
          id: category.id,
          name: category.name,
          monthlyLimit: String(category.monthlyLimit),
        }))
      );
      setRemovedIds([]);
    } catch {
      toast.error('Could not load your categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const setName = (key: string, name: string) =>
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, name, dirty: Boolean(row.id), error: undefined } : row
      )
    );

  const setLimit = (key: string, monthlyLimit: string) =>
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, monthlyLimit, dirty: Boolean(row.id), error: undefined } : row
      )
    );

  const addRow = () =>
    setRows((current) => [...current, { key: newKey(), name: '', monthlyLimit: '' }]);

  const removeRow = (key: string) => {
    // Two sibling state updates — never nest setRemovedIds inside the setRows
    // updater. An updater must be pure; React StrictMode double-invokes it, which
    // would queue the deleted id twice and fire DELETE twice (the second 404s).
    const row = rows.find((r) => r.key === key);
    if (row?.id) setRemovedIds((ids) => [...ids, row.id as string]);
    setRows((current) => current.filter((r) => r.key !== key));
  };

  const save = async () => {
    // 1. local validation — instant feedback before any request.
    let blocked = false;
    const validated = rows.map((row) => {
      const result = categorySchema.safeParse({
        name: row.name,
        monthlyLimit: row.monthlyLimit,
      });
      if (!result.success) {
        blocked = true;
        return { ...row, error: result.error.issues[0]?.message };
      }
      return { ...row, error: undefined };
    });

    // 2. local duplicate-name check (case-insensitive) — pre-empts the 409.
    const seen = new Set<string>();
    validated.forEach((row, index) => {
      const normalized = row.name.trim().toLowerCase();
      if (seen.has(normalized)) {
        validated[index] = { ...row, error: 'Duplicate category name' };
        blocked = true;
      } else {
        seen.add(normalized);
      }
    });

    if (blocked) {
      setRows(validated);
      return;
    }

    // 3. reconcile with the backend.
    setSaving(true);
    const working = [...validated];
    const stillRemoved: string[] = [];
    let deleteFailed = false;
    let rowFailed = false;

    for (const id of removedIds) {
      try {
        await deleteCategory(id);
      } catch (error) {
        // 404 = already gone, which is exactly the goal — not a failure.
        if (error instanceof ApiError && error.status === 404) continue;
        stillRemoved.push(id);
        deleteFailed = true;
      }
    }

    for (let i = 0; i < working.length; i++) {
      const row = working[i];
      const input = { name: row.name.trim(), monthlyLimit: Number(row.monthlyLimit) };
      try {
        if (!row.id) {
          const created = await createCategory(input);
          working[i] = { ...row, id: created.id, monthlyLimit: String(created.monthlyLimit) };
        } else if (row.dirty) {
          const updated = await updateCategory(row.id, input);
          working[i] = { ...row, monthlyLimit: String(updated.monthlyLimit), dirty: false };
        }
      } catch (error) {
        working[i] = { ...row, error: messageFor(error) };
        rowFailed = true;
      }
    }

    setRows(working);
    setRemovedIds(stillRemoved);
    setSaving(false);

    if (deleteFailed) toast.error('Some categories could not be deleted');
    if (deleteFailed || rowFailed) return;
    toast.success('Categories saved');
    onOpenChange(false);
  };

  const totalLimit = rows.reduce((sum, row) => {
    const value = Number(row.monthlyLimit);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return {
    rows,
    loading,
    saving,
    count: rows.length,
    totalLabel: euro.format(totalLimit),
    setName,
    setLimit,
    addRow,
    removeRow,
    save,
  };
}
