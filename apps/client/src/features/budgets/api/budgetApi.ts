import { apiClient } from '@/shared/api/client';
import type { components } from '@/shared/api/generated/budget-service';
import { unwrap } from '@/shared/lib/api';

/**
 * api: thin wrappers over the budget-service endpoints, built on the shared
 * typed apiClient — URL, method, params and body of every call are
 * compile-checked against openapi/budget-service.json (regenerate with
 * `bun run openapi`). No React, no UI here.
 */

// A category response always carries every field; springdoc types them optional
// (no @NonNull on the record), so re-require them for ergonomic consumers.
export type Category = Required<components['schemas']['CategoryResponse']>;

export type CategoryInput = components['schemas']['CategoryRequest'];

export type CategoryStatus = Required<components['schemas']['BudgetStatusResponse']>;

export async function listCategories(): Promise<Category[]> {
  return unwrap(await apiClient.GET('/api/budgets/categories')) as Category[];
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return unwrap(await apiClient.POST('/api/budgets/categories', { body: input })) as Category;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  return unwrap(
    await apiClient.PATCH('/api/budgets/categories/{id}', {
      params: { path: { id } },
      body: input,
    })
  ) as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  unwrap(await apiClient.DELETE('/api/budgets/categories/{id}', { params: { path: { id } } }));
}

export async function getBudgetStatus(): Promise<CategoryStatus[]> {
  return unwrap(await apiClient.GET('/api/budgets/status')) as CategoryStatus[];
}
