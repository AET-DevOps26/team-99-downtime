# ⚡ ExpenseFlow `v1.0` `by 99 Downtime`

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/AET-DevOps26/team-99-downtime?style=for-the-badge) ![GitHub branch check runs](https://img.shields.io/github/check-runs/AET-DevOps26/team-99-downtime/main?style=for-the-badge) ![Swagger Validator](https://img.shields.io/swagger/valid/3.0?specUrl=https%3A%2F%2Fraw.githubusercontent.com%2FOAI%2FOpenAPI-Specification%2Fc442afe06ec28443df0c69d01dc38c54968b246f%2Fexamples%2Fv2.0%2Fjson%2Fpetstore-expanded.json&style=for-the-badge)

> [!WARNING]
> This project is still in development.

## Problem Statement

The full problem statement — target users, main functionality, GenAI integration, scenarios, and the preliminary microservice architecture — lives in [`docs/problem/PROBLEM_STATEMENT.md`](docs/problem/PROBLEM_STATEMENT.md).

## Diagrams

All architecture and design diagrams live under [`docs/architecture/`](docs/architecture/):

- [`SERVICE_OVERVIEW.md`](docs/architecture/SERVICE_OVERVIEW.md) — high-level service topology (frontend, backend services, data layer).
- [`UML_DIAGRAM.md`](docs/architecture/UML_DIAGRAM.md) — UML use case diagram (actors, system boundary, `<<include>>` / `<<extend>>` relationships).

> [!NOTE]
> Diagrams under `docs/` are written in [Mermaid](https://mermaid.js.org/). They render automatically on GitHub. To preview them locally in VS Code you might need to install an extension.

## Development Setup

1. [Install bun](https://bun.com/docs/installation)
1. Install dependecies `bun install`

Run `bunx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Launch applications

```sh
bun dev
```

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
