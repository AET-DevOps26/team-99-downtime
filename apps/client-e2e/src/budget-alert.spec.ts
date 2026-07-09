import { expect, test } from '@playwright/test';

import { addManualExpense, ensureCategory } from './helpers';

/**
 * Covers the budget threshold alert flow including notification delivery:
 * an expense crossing 80% of a category limit must surface in the bell via the
 * SSE stream, without a reload.
 */
test('crossing a budget threshold delivers a bell notification', async ({ page }) => {
  await ensureCategory(page, 'Dining', 10);

  await page.goto('/');
  // €9 of a €10 limit = 90% → crosses the 80% threshold. On a retry attempt the
  // same expense lands again (180% → the 100% threshold fires instead), so the
  // assertions below accept any threshold value.
  await addManualExpense(page, { category: 'Dining', amount: '9', description: 'Team dinner' });

  const bell = page.getByRole('button', { name: 'Notifications' });
  const badge = bell.locator('span');

  // Primary assertion: the unread badge appears WITHOUT a reload — this is the
  // SSE delivery under test. The threshold check is @Async fire-and-forget on
  // the backend, hence the generous timeout.
  try {
    await expect(badge).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    // Diagnostic only — the test still fails. A reload refetches notifications,
    // separating "never created" from "created but SSE delivery broke".
    const createdServerSide = await page
      .reload()
      .then(() => badge.waitFor({ state: 'visible', timeout: 5_000 }))
      .then(() => true)
      .catch(() => false);
    test.info().annotations.push({
      type: 'diagnostic',
      description: createdServerSide
        ? 'Notification existed after reload: created server-side, SSE delivery failed'
        : 'Notification absent even after reload: threshold check or creation failed',
    });
    throw error;
  }

  const unreadBefore = (await badge.textContent()) ?? '';

  await bell.click();
  const alert = page.getByRole('menuitem').filter({ hasText: /% of Dining reached/ });
  await expect(alert.first()).toBeVisible();

  // Selecting the item marks it read and closes the dropdown.
  await alert.first().click();
  if (unreadBefore === '1') {
    await expect(badge).toBeHidden();
  } else {
    await expect(badge).not.toHaveText(unreadBefore);
  }
});
