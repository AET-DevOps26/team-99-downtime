import { expect, test } from '@playwright/test';

import { addManualExpense, ensureCategory } from './helpers';

test('added expense appears in the transaction list and on the dashboard', async ({ page }) => {
  // Usually a no-op: "Groceries" is among the categories seeded for new users.
  await ensureCategory(page, 'Groceries', 1000);

  // Unique per attempt so assertions target this attempt's row even on retries.
  const description = `Rewe run ${Date.now()}`;

  await page.goto('/transactions');
  await addManualExpense(page, { category: 'Groceries', amount: '23.45', description });
  // exact: the row's actions cell is also named after the description.
  await expect(page.getByRole('cell', { name: description, exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByText(description)).toBeVisible();
});
