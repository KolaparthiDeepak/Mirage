---
title: 17 — Environments and variables
size: S (1–2 days)
depends on: 02
status: DRAFT
---

# 17 — Environments and variables

Make two existing Preview surfaces real, and use them for something the current
design cannot do: one mock that behaves differently per environment.

## Problem

`app/_lib/preview-store.tsx` holds environments and variables in `sessionStorage`.
They vanish when the tab closes, are invisible to anyone else, and only affect the
request runner's base URL. `SEED_ENVIRONMENTS` is a single `Local` entry with an
empty base URL — deliberately, because seeding fake hosts once meant Execute would
POST the user's headers at a host that does not exist (commit `98e489b`).

## Design

### Two distinct things, currently conflated

**Environments** are *where the runner points* — a base URL. They belong to the
user, not the project: my localhost is not yours. Stored per user per project,
synced across that user's devices once plan 14 gives us a user.

**Variables** are *values substituted into requests and responses*. They belong to
the project and are shared. That distinction is the whole reason this plan exists.

### Variables

```yaml
variables:
  - { key: baseCustomerId, value: cust-ok, scope: project }
  - { key: apiKey, value: "***", scope: project, secret: true }
```

Two use sites:

1. **In the runner and in flows** — `{{vars.apiKey}}` in a request, resolved
   client-side or run-side. This is what the current Preview UI gestures at.
2. **In rule responses** — `{{vars.merchantName}}` in a response body, resolved at
   request time. This is new and is the genuinely useful half: change one variable,
   every response using it changes, with no rule edits.

Site 2 is an addition to `src/engine/template.ts`'s allowlist — one new pattern,
`^vars\.[A-Za-z0-9_-]+$`, resolved from project config, with the same
missing-value-warns-and-renders-empty behaviour every other token has. It stays an
allowlist; nothing about the grammar's safety changes.

### Secrets

A variable marked `secret: true` is write-only in the UI (shown as `***`, never
returned by the API) and **never usable in a response body** — only in a runner or
flow request. A secret substituted into a mock response would be exfiltrated by
anyone calling the public mock URL. This restriction is enforced at save time with
a clear error, not documented and hoped for.

### Per-environment overrides — the payoff

```yaml
variables:
  - key: riskScore
    value: 12
    overrides: { staging: 85 }
```

One project, one set of rules, different data per environment. Today this requires
either duplicate projects or duplicate rules.

Environment selection for a mock request comes from an `x-mirage-env` header,
defaulting to the project's default environment. Traffic records which environment
served each request (the field already exists in plan 04's entry).

## UI

- `Variables` page becomes real: table, add/edit/delete, scope, secret toggle,
  per-environment override columns.
- `Environments` page: user's environments for the runner, plus the project's
  environment names used for overrides. The two are visually separated, because
  conflating them is exactly the current confusion.
- The rule editor autocompletes `{{vars.` from the project's variables.

## Removals

The `environments`, `variables` and `activeEnvId` slices of `preview-store.tsx`.
`SEED_ENVIRONMENTS` stays as the empty-state default.

## Tests

- A variable substituted into a response body resolves at request time.
- A secret variable is rejected at save if referenced in a response body.
- A secret is never returned by any read API.
- An environment override applies when `x-mirage-env` matches, and the base value
  applies otherwise.
- An unknown `{{vars.x}}` warns and renders empty, matching existing token behaviour.
- Variables survive a browser restart (the current failure).

## Risks

| risk | mitigation |
|---|---|
| A secret leaks through a mock response | Enforced at save; a test asserts the rejection. |
| Variable indirection makes responses hard to reason about | The rule editor shows resolved values inline next to the template. |
| Environment header spoofing on a public mock | Environments carry no authorisation meaning; they select data only. Documented. |

## Rollback

Variables collapse to their base value; overrides ignored. `{{vars.*}}` in a
response renders empty with a warning, exactly like any other missing token.

## Done when

A variable changed in one place changes every response using it, secrets cannot
reach a response body, and nothing is lost when the tab closes.
