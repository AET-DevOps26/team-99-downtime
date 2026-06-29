import type { components } from '@/shared/api/generated/budget-service';
import { apiFetch } from '@/shared/lib/api';

/**
 * api: thin wrappers over the budget-service category endpoints. Reaches the
 * service through the gateway at its full path — budget-service owns /api/budgets.
 * No React, no UI here.
 *
 * The request/response shapes are the auto-generated OpenAPI types
 * (apps/client/src/shared/api/generated, produced by `bun run openapi`), so they
 * track the backend contract instead of being hand-maintained here.
 */
const BASE = '/api/budgets/categories';

// A category response always carries every field; springdoc types them optional
// (no @NonNull on the record), so re-require them for ergonomic consumers.
export type Category = Required<components['schemas']['CategoryResponse']>;

export type CategoryInput = components['schemas']['CategoryRequest'];

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

export interface CategoryStatus {
  categoryId: string;
  name: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export function getBudgetStatus() {
  return apiFetch<CategoryStatus[]>('/api/budgets/status');
}
