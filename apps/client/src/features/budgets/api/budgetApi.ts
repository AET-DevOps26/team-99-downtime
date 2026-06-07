import { apiFetch } from '@/shared/lib/api';

/**
 * api: thin wrappers over the budget-service category endpoints. Reaches the
 * service through the gateway, which strips the `/budgets` prefix — so this hits
 * budget-service as `/api/categories`. No React, no UI here.
 */
const BASE = '/budgets/api/categories';

export interface Category {
  id: string;
  name: string;
  monthlyLimit: number;
}

export interface CategoryInput {
  name: string;
  monthlyLimit: number;
}

export function listCategories() {
  return apiFetch<Category[]>(BASE);
}

export function createCategory(input: CategoryInput) {
  return apiFetch<Category>(BASE, { method: 'POST', body: JSON.stringify(input) });
}

export function updateCategory(id: string, input: CategoryInput) {
  return apiFetch<Category>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteCategory(id: string) {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
