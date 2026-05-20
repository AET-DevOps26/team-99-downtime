# ⚡ ExpenseFlow `v1.0` `by 99 Downtime`

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/AET-DevOps26/team-99-downtime?style=for-the-badge) ![GitHub branch check runs](https://img.shields.io/github/check-runs/AET-DevOps26/team-99-downtime/main?style=for-the-badge) ![Swagger Validator](https://img.shields.io/swagger/valid/3.0?specUrl=https%3A%2F%2Fraw.githubusercontent.com%2FOAI%2FOpenAPI-Specification%2Fc442afe06ec28443df0c69d01dc38c54968b246f%2Fexamples%2Fv2.0%2Fjson%2Fpetstore-expanded.json&style=for-the-badge)

> [!WARNING]
> This project is still in development.

## Docs

- [Problem Statement](docs/problem/PROBLEM_STATEMENT.md)
- [Service Overview](docs/architecture/SERVICE_OVERVIEW.md) — UML / component / service diagrams + API calls diagrams

## Development Setup

1. [Install bun](https://bun.com/docs/installation)
1. Install dependencies `bun install` — this also sets up the Git hooks via Husky automatically

## Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to enforce code quality on every commit.

**pre-commit** — runs [lint-staged](https://github.com/lint-staged/lint-staged) on staged files:

| File type                                   | Tool                                       |
| ------------------------------------------- | ------------------------------------------ |
| `*.ts`, `*.tsx`                             | ESLint + Prettier                          |
| `*.js`, `*.json`, `*.md`, `*.yaml`, `*.yml` | Prettier                                   |
| `*.py`                                      | Ruff (format + lint)                       |
| `*.java`                                    | Spotless (Google Java Format) + Checkstyle |

**commit-msg** — enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint.

Commit message format: `<type>(<scope>): <subject>`

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

Examples:

```
feat(client): add expense list view
fix(budget-service): correct category limit calculation
chore: update dependencies
```

## Launch applications

```sh
bun dev
```

## Services

### Spring Boot services (Java 21 + Gradle)

| Service              | Path                                                      | Port |
| -------------------- | --------------------------------------------------------- | ---- |
| transaction-service  | [`apps/transaction-service/`](apps/transaction-service)   | 8080 |
| notification-service | [`apps/notification-service/`](apps/notification-service) | 8081 |
| budget-service       | [`apps/budget-service/`](apps/budget-service)             | 8082 |

**Prerequisites:** JDK 21+

Run via Nx (recommended, integrates with `bun dev`):

```sh
bunx nx serve transaction-service
bunx nx serve notification-service
bunx nx serve budget-service
```

Or run Gradle directly:

```sh
cd apps/<service-name>
./gradlew bootRun
```

Verify the health endpoint of each service:

```sh
curl http://localhost:8080/actuator/health   # transaction-service
curl http://localhost:8081/actuator/health   # notification-service
curl http://localhost:8082/actuator/health   # budget-service
# => {"status":"UP"}
```

Other Nx targets: `build`, `test` (e.g. `bunx nx build transaction-service`).

### Client (React + Vite + Tailwind v4 + shadcn/ui)

| App    | Path                          | Port |
| ------ | ----------------------------- | ---- |
| client | [`apps/client/`](apps/client) | 4200 |

**Stack:** React 19, Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn/ui (new-york style, neutral base).

Run:

```sh
bunx nx serve client      # dev server at http://localhost:4200
bunx nx build client      # production build → dist/apps/client
bunx nx test client       # vitest
```

**Path alias:** `@/*` → `apps/client/src/*` (scoped to this app; defined in [`apps/client/tsconfig.json`](apps/client/tsconfig.json) for TypeScript and in [`apps/client/vite.config.mts`](apps/client/vite.config.mts) `resolve.alias` for the bundler). Import shared utilities like `import { cn } from '@/lib/utils'`.

**Adding shadcn components:**

```sh
cd apps/client
bunx shadcn@latest add <component>      # e.g. card, input, dialog
```

Components land in `src/components/ui/`. Configuration lives in [`apps/client/components.json`](apps/client/components.json).

**Theming:** Tailwind v4 uses CSS-first config — design tokens (colors, radius, dark mode) are in [`apps/client/src/styles.css`](apps/client/src/styles.css). Add a `.dark` class to `<html>` to toggle dark mode. No `tailwind.config.js`.

## Run tasks

To run tasks with Nx use:

```sh
bunx nx <target> <project-name>
```

For example:

```sh
bunx nx build client
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

To install a new plugin you can use the `nx add` command. Here's an example of adding the React plugin:

```sh
bunx nx add @nx/react
```

Use the plugin's generator to create new projects. For example, to create a new React library:

```sh
# Generate a library
bunx nx g @nx/react:lib some-lib
```

You can use `bunx nx list` to get a list of installed plugins. Then, run `bunx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
