import { expect, test } from '@playwright/test';

import { signIn, signUp, uniqueUser } from './helpers';

// This spec exercises the auth flows themselves, so it must not inherit the
// shared session from auth.setup.ts.
test.use({ storageState: { cookies: [], origins: [] } });

test('sign up, sign out, and sign back in', async ({ page }) => {
  const user = uniqueUser('auth');

  await signUp(page, user);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, user);
});
