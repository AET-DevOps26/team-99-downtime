# Contributing

## Branch naming

Branches must follow the pattern `<type>/<short-description>`, where `type` matches the Conventional Commits scope below.

```
feat/add-budget-alerts
fix/transaction-parse-crash
docs/update-kubernetes-guide
chore/bump-gradle-wrapper
```

## Conventional Commits

Every commit title must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

| Type       | When to use                              |
| ---------- | ---------------------------------------- |
| `feat`     | New feature visible to users             |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `chore`    | Tooling, deps, CI, build scripts         |
| `refactor` | Code change that is neither feat nor fix |
| `test`     | Adding or updating tests                 |
| `perf`     | Performance improvement                  |
| `ci`       | Changes to GitHub Actions workflows      |

Scope is optional but encouraged (e.g. `transaction-service`, `k8s`, `client`).

The repo enforces commit message format via [commitlint](https://commitlint.js.org/) on every push.

## PR → review → merge flow

1. **Open a PR** against `main`. Fill in the PR template — linked issue and checklist.
2. **CI must be green** — lint, build, and tests all pass before review is requested.
3. **One approval** from any other team member is required to merge.
4. **Squash or rebase** — no merge commits. Keep the commit history linear.
5. **Delete the branch** after merge.

## Local development

See [docs/development/SETUP.md](docs/development/SETUP.md) for the full setup guide.

```sh
# Start full stack
docker compose up -d --build

# Run all checks
bun run lint
bun run build
bun run test
```
