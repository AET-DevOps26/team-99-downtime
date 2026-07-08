import { expect, test } from '@playwright/test';

/**
 * Fail-fast deployment gate: separates "the deploy is broken" from "a feature
 * is broken". The setup and chromium projects depend on this one, so nothing
 * else runs when the app is unreachable.
 */
test('unauthenticated visitor reaches the login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
