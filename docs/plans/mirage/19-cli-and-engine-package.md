---
title: 19 — CLI and engine package
size: M (3–5 days)
depends on: 02
status: DRAFT
---

# 19 — CLI and engine package

Put Mirage where developers already are: the terminal and the test suite.

## Problem

Mirage is reachable only through a browser and a hosted URL. That means no offline
work, no mocks inside a unit test, and no way to script anything. Meanwhile
`src/engine/*` is a pure, dependency-free resolver that would run anywhere — it is
simply not packaged.

## 19.1 `@mirage/engine` — the package

Publish `src/engine/*` plus the compiler as a library:

```ts
import { compileProject, resolve, parseRequest } from "@mirage/engine";

const config = compileProject(yamlString);
const res = resolve(parseRequest(req, "/orders"), config);
```

Why this matters more than it looks: a consumer's test suite can run **the same
resolver** the hosted service runs, against **the same rule files**. No drift
between "mocked in CI" and "mocked in staging" — which is the failure mode that
makes teams distrust mock servers.

Zero runtime dependencies except `yaml` and `zod`, both already present. Node ≥ 20,
ESM, types included, semver from 0.1.0.

## 19.2 `mirage` — the CLI

```
mirage dev [--port 3100] [--watch]     serve mocks/** locally, hot reload
mirage push [--project slug]           sync local files to the hosted store
mirage pull [--project slug]           export a hosted project to mocks/<slug>/
mirage tail [--project slug]           stream traffic to the terminal
mirage trace <traffic-id>              print a match trace (plan 06)
mirage flow run <flow-id>              run a flow, exit non-zero on failure (plan 16)
mirage validate [path]                 compile and report errors, exit non-zero
```

`mirage dev` is the highest-value command by a distance: a real mock server on
`localhost:3100`, hot-reloading on file save, no cloud, no network, works on a
plane. It is `compileMocks()` plus `node:http` plus a file watcher — perhaps 150
lines, because the engine already does everything hard.

`mirage tail` and `mirage trace` are what turn plans 04 and 06 into something usable
from a terminal without alt-tabbing to a browser mid-debug.

`mirage validate` in a pre-commit hook or CI is the file-workflow equivalent of the
build gate, and keeps the repo path first-class.

### Configuration

`.miragerc.json` or `MIRAGE_TOKEN` + `MIRAGE_URL` environment variables. `push`
and `pull` require a token (plan 14; the plan 03 stopgap token until then).

`pull` writes a `mocks/<slug>/` tree byte-compatible with the compiler — the same
generator as plan 03's YAML export, so there is one implementation, not two.

### Push/pull conflicts

`push` refuses when the remote `config_version` is newer than the version recorded
in the local `.mirage-lock`, and prints the diff. `--force` overrides.

Fighting file and store writers is a real problem and this plan does not solve it
in general: a project is either repo-managed or store-managed (plan 02), and
`push`/`pull` are a deliberate handoff between the two, not continuous sync.
Continuous bidirectional sync is a distributed-systems problem with no good answer
at this scale, and pretending otherwise would produce a feature that loses work.

## Distribution

`npx mirage` with no install, plus a published npm package. Single-binary builds
are deferred — `npx` covers a Node-shaped audience, which this is.

## Tests

- `mirage dev` serves the same responses as the hosted route for the same files
  (a shared golden-file suite against `card-block-lost`).
- Editing a rule file reloads within 500 ms.
- `push` then `pull` round-trips a project to byte-identical YAML.
- `push` against a newer remote refuses and prints a diff.
- `validate` exits non-zero on the known-bad compile fixtures.
- `flow run` exits non-zero on a failing assertion.
- The engine package builds and runs with no dev dependencies present.

## Risks

| risk | mitigation |
|---|---|
| CLI and hosted behaviour diverge | Shared golden-file suite runs against both in CI. |
| Push/pull loses work | Version check plus explicit `--force`; project ownership is single-writer by design. |
| Package maintenance burden | Publish the engine only, not the UI. Narrow surface, semver, tests. |

## Rollback

Unpublish or deprecate. Nothing hosted depends on the CLI.

## Done when

`npx mirage dev` serves `mocks/card-block-lost` locally with hot reload and byte-
identical responses to production, and `mirage tail` streams live traffic.
