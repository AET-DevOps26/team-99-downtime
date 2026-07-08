import fs from 'node:fs';
import path from 'node:path';

import { test as setup } from '@playwright/test';

import { STORAGE_STATE, signUp, uniqueUser } from './helpers';

/**
 * Signs up the fresh user every data spec shares and saves its session, so the
 * chromium project starts authenticated. A new user per run keeps runs
 * independent on the shared stage database.
 */
setup('sign up the shared e2e user', async ({ page }) => {
  await signUp(page, uniqueUser('shared'));
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
