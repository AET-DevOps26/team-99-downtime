# Client architecture

How `apps/client` is built. Read first. Know where code lives, where new code goes.
Change the shape? Update this file in the same commit. Keep it true.

## Tree

```
src/
  main.tsx     entry point. mounts <App/> into the DOM. nothing else.
  app/         app wiring. router + providers. NO feature code.
    app.tsx      RouterProvider + global Toaster.
    router.tsx   route table.
    guards/      route guards (GuestRoute, ProtectedRoute).
  pages/       one file per route. thin. calls a hook, gives data to ui.
  features/<name>/        one folder = one feature. everything for it lives here.
    api/        talk to server. plain functions. no React.
    hooks/      the brain. state, submit, errors, navigation.
    schemas/    zod schemas. input shapes + types.
    ui/         dumb components. take props, draw. nothing else.
    index.ts    the door. outside world imports only this.
  shared/       stuff many features use.
    ui/         shadcn + generic parts (button, card, wordmark)
    lib/        utils, auth-client singleton
    layout/     app frame (Sidebar, Header, AppLayout)
    hooks/      cross-feature hooks (none yet; placeholder)
```

`features/auth/` is the real example. Copy its shape for new features.

## Where does my file go?

Ask one thing: does it **call server / hold logic / validate / draw**?
→ `api` / `hooks` / `schemas` / `ui`. Done.

## What each part does

- **api/** — sends requests, gets data back. knows nothing about React or screens.
  one function per server action. `authApi.ts` has `signInWithEmail`, etc.
- **hooks/** — the brain of the feature. makes the form, calls api, runs schema
  check, shows error toast, navigates. returns plain stuff for a page to use.
  `useLogin.ts` is this.
- **schemas/** — rules for what input is valid (zod). types come from here too.
  `authSchemas.ts`.
- **ui/** — looks only. gets everything as props. has no fetch, no navigate, no
  rules. `LoginForm.tsx` takes `form`, `onSubmit`, `onGoogle` and just draws.
- **index.ts** — lists what the feature lets others use. import `@/features/auth`,
  never the inside files.
- **pages/** — glue. `const {form, onSubmit} = useLogin()` then `<LoginForm .../>`.
  no logic of its own.

## Why it's split this way (the 3 laws)

- **data ≠ logic ≠ ui.** three layers, never mixed.
  - data = `api/` (talks to server). logic = `hooks/` (the brain). ui = `ui/` (draws).
  - swap one without touching the others. new backend? change `api/` only. new
    look? change `ui/` only. same brain.
- **SRP — one file, one job.** a file does ONE thing. a hook that also draws is
  two jobs → split. if you can't say its job in one short line, it's too big.
- **open/closed — add, don't edit.** new behavior = new file (new feature, new
  hook, new schema). avoid changing shared/working files to bolt on extras.
  `ui/` parts take props so you extend by passing new props, not by editing them.

## Flow (how a click works)

page calls hook → hook does the work (api + schema + nav) → ui just draws.
data goes down as props. nothing smart lives in ui.

## Rules

- import a feature only through `@/features/<name>`.
- deps go DOWN only: `app → pages → features → shared`.
- ui takes props and draws. logic goes in a hook.
- one job per file. file too big = split it.
- better-auth sdk lives only in `shared/lib/auth-client.ts`.

## FORBIDDEN (do not do this)

- ❌ deep import: `@/features/auth/hooks/useLogin`. use the `index.ts` door.
- ❌ feature imports another feature. (`features/budgets` importing `features/auth`)
  if two features need it, move it to `shared/`.
- ❌ fetch / axios / sdk call inside a `ui/` file. that belongs in `api/`.
- ❌ `useNavigate`, `toast`, business rules inside a `ui/` file. → `hooks/`.
- ❌ logic inside a `pages/` file. page only wires hook → ui.
- ❌ shared importing a feature. shared knows nothing about features.
- ❌ a folder grouped by type at the top (`src/components`, `src/hooks`). we group
  by feature, not by type.
- ❌ business logic in `app/`. app is wiring only.

## New feature

1. make `features/<name>/` with `api/ hooks/ schemas/ ui/ index.ts`
2. build ui dumb, hook smart, page wires them
3. export page-facing bits from `index.ts`
4. add the route in `app/router.tsx`
