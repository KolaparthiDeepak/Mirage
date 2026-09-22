# mirage-cli

Run Mirage mock projects locally, offline, with hot reload — plus
compile-and-validate for CI. Put Mirage where developers already are: the
terminal, not just a browser and a hosted URL.

```
mirage dev [dir] [--port 3100] [--no-watch]   serve mocks/** locally, hot reload
mirage validate [dir]                          compile and report errors, exit non-zero
```

`mirage dev` serves `/m/<slug>/...` on `localhost`, the exact URL convention
the hosted service uses — point a test suite at `localhost:3100` instead of
the hosted URL and nothing else changes. It runs `@mirage/engine`'s real
resolver against real rule files, hot-reloading on save (debounced ~80ms).

`mirage validate` is the file-workflow equivalent of the build gate; run it
in a pre-commit hook or CI.

## Not yet implemented

`push`, `pull`, `tail`, `trace`, `flow run` are recognised by name (running
them prints "not yet implemented" and exits 1) but not built in this pass —
each needs a running hosted deployment and an admin token (plan 14's
stopgap, `MIRAGE_ADMIN_TOKEN`, until real auth exists) to mean anything, and
verifying them meaningfully means standing up the whole Next.js app inside a
test, not just this package. A real follow-up, deliberately out of this
plan's first cut.

## Current status

Like `@mirage/engine` (see its own README), this package has **no build
step** and is **not published**: `bin/mirage.mjs` runs `src/cli.ts` directly
via `tsx` (a devDependency of the workspace root), and `src/*` imports the
main app's compiler (`src/compile/compile.ts`) via a relative path. Both work
today inside this workspace checkout — `node packages/cli/bin/mirage.mjs dev
mocks` is a real, working local mock server right now — but neither would
survive being `npm install`ed on their own yet. Publishing needs: a real
build (bundling `src/cli.ts` and everything it imports, including the main
app's compiler, into this package's own `dist/`), and picking a package name
that doesn't collide with `npx`'s default "run the bin matching the package
name" behavior (this package is named `mirage-cli` specifically to avoid
colliding with the repository root's own private package name, `mirage` —
whoever actually publishes this should decide whether that's still the right
name, or whether by then the CLI has moved to its own repo).
