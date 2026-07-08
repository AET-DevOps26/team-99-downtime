import { expect, type Page } from '@playwright/test';

/** Where auth.setup.ts saves the shared session (relative to the config dir). */
export const STORAGE_STATE = 'playwright/.auth/user.json';

/** Better Auth requires ≥ 12 characters. */
export const PASSWORD = 'E2e-t99-Passw0rd!';

export interface E2eUser {
  name: string;
  email: string;
  password: string;
}

/**
 * A user that can never collide across runs, retries, or repeated manual
 * dispatches: run id scopes the CI run, the UUID slice scopes the attempt.
 */
export function uniqueUser(tag: string): E2eUser {
  const runId = process.env.GITHUB_RUN_ID ?? 'local';
  const nonce = crypto.randomUUID().slice(0, 8);
  return {
    name: `E2E ${tag}`,
    email: `e2e+${tag}-${runId}-${nonce}@e2e.test`,
    password: PASSWORD,
  };
}

export async function signUp(page: Page, user: E2eUser) {
  await page.goto('/signup');
  await page.getByLabel('Name').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

export async function signIn(page: Page, user: E2eUser) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

/**
 * Creates a budget category through the "Manage categories" modal unless a
 * category with that name already exists. Idempotent so every spec can set up
 * its own data regardless of which specs ran before it (spec file order is
 * non-contractual).
 */
export async function ensureCategory(page: Page, name: string, monthlyLimit: number) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage categories' }).click();
  const dialog = page.getByRole('dialog', { name: 'Budget categories' });
  await expect(dialog).toBeVisible();
  // The add button renders once loading is done, so rows are settled after this.
  const addButton = dialog.getByRole('button', { name: 'Add category' });
  await expect(addButton).toBeVisible();

  const nameInputs = dialog.getByPlaceholder('Category name');
  const existingNames = await nameInputs.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value)
  );
  if (existingNames.includes(name)) {
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    return;
  }

  await addButton.click();
  await nameInputs.last().fill(name);
  await dialog.getByPlaceholder('0').last().fill(String(monthlyLimit));
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Categories saved')).toBeVisible();
  await expect(dialog).toBeHidden();
}

/**
 * Adds an expense through the Manual tab of the "Add expense" modal. Assumes a
 * page with an "Add expense" button (dashboard or transactions). The date field
 * defaults to today, which is what the budget threshold check needs.
 */
export async function addManualExpense(
  page: Page,
  opts: { category: string; amount: string; description: string }
) {
  await page.getByRole('button', { name: 'Add expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add expense' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Category').click();
  // exact: the picker also holds the 11 predefined categories every user is
  // seeded with, and names overlap by substring ("Dining" vs "Dining Out").
  await page.getByRole('option', { name: opts.category, exact: true }).click();
  await dialog.getByLabel('Amount (€)').fill(opts.amount);
  await dialog.getByLabel('Description').fill(opts.description);
  await dialog.getByRole('button', { name: 'Add expense' }).click();

  await expect(page.getByText('Expense added')).toBeVisible();
  await expect(dialog).toBeHidden();
}
