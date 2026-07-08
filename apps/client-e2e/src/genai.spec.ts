import { expect, test } from '@playwright/test';

import { ensureCategory } from './helpers';

/**
 * Smoke test for the GenAI free-text expense path (client → gateway →
 * transaction-service → genai-service → LLM). One test, tolerant assertions:
 * the LLM is nondeterministic and each run costs API credits, so we only
 * assert that *a* transaction was created — never a specific category or
 * description.
 */
test('free-text entry creates a transaction via the AI', async ({ page }) => {
  test.setTimeout(90_000);

  // Every user is seeded with predefined categories (incl. Groceries) on first
  // access; this is the self-containment fallback should that ever change.
  await ensureCategory(page, 'Groceries', 1000);

  await page.goto('/transactions');
  const dataRows = page.locator('tbody tr').filter({ hasText: '€' });
  // Wait until the table settled (either state) before counting, so skeleton
  // rows don't get counted as zero and weaken the increase assertion.
  await expect(page.getByText('No transactions yet').or(dataRows.first())).toBeVisible();
  const rowsBefore = await dataRows.count();

  await page.getByRole('button', { name: 'Add expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add expense' });
  await dialog.getByRole('tab', { name: 'Free text' }).click();
  await dialog.getByLabel('Describe your expenses').fill('12.30 groceries at Rewe');
  await dialog.getByRole('button', { name: 'Add expense' }).click();

  // "Expense added" or "N expenses added" — generous timeout for the LLM call.
  await expect(page.getByText(/expenses? added/i)).toBeVisible({ timeout: 45_000 });
  await expect(dialog).toBeHidden();

  await expect.poll(() => dataRows.count(), { timeout: 15_000 }).toBeGreaterThan(rowsBefore);
});
