# client-e2e

Playwright end-to-end tests that run against a **deployed** environment — stage by default. The suite never builds or serves the app itself; CI triggers it after every successful stage deployment (`.github/workflows/e2e.yml`), and a failing run never blocks PRs or the CD pipeline.

## Running

```sh
# against stage (default)
bun nx e2e client-e2e

# against a local stack (gateway on :9099)
E2E_BASE_URL=http://localhost:9099 bun nx e2e client-e2e

# one spec, headed
cd apps/client-e2e && bunx playwright test budget-alert --headed
```

First time: `bunx playwright install chromium`.

The HTML report lands in `apps/client-e2e/playwright-report/` (`bunx playwright show-report` to open), traces for failed runs in `apps/client-e2e/test-results/`.

## How the suite is structured

Projects run in a dependency chain — `smoke` (deploy reachable at all?) → `setup` (signs up a fresh unique user per run, saves its session to `playwright/.auth/`) → `chromium` (the data specs, authenticated as that user).

Every data spec is self-contained: it creates the categories it needs via the idempotent `ensureCategory` helper and never depends on another spec's data. Spec file order is non-contractual.

Watch-outs (see issue #116): the budget threshold check is `@Async` fire-and-forget on the backend, so the bell assertion waits generously; `genai.spec.ts` makes one real LLM call per run; e2e users accumulate in the stage database (~2 per run).
