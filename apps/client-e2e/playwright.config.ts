import { defineConfig, devices } from '@playwright/test';

import { STORAGE_STATE } from './src/helpers';

/**
 * E2e suite against a deployed environment (stage by default). There is no
 * `webServer` block on purpose: the suite validates the real deployment, it
 * never builds or serves the app itself.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'https://stage.t99.stud.k8s.aet.cit.tum.de';

export default defineConfig({
  testDir: './src',
  // Specs share one account and the budget threshold flags are stateful per
  // user/month, so they must run one at a time, in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Generous ceilings: the suite talks to a live cluster and one spec waits on
  // an LLM round-trip.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Explicit paths: without them Playwright anchors its defaults to the nearest
  // package.json (the workspace root, as this project has none of its own).
  // All relative paths here resolve against this config file's directory.
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: '../../reports/apps/client-e2e/junit.xml' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Fail-fast gate: if the deployment itself is broken, skip everything else.
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Signs up the shared run user and saves its session for the main project.
    {
      name: 'setup',
      dependencies: ['smoke'],
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: [/smoke\.spec\.ts/, /auth\.setup\.ts/],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
  ],
});
