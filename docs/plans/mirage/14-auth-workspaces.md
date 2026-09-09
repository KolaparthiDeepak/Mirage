---
title: 14 — Auth, workspaces and access
size: M (3–5 days) — reduced from L by the Supabase Auth decision
depends on: 02
status: DRAFT
---

# 14 — Auth, workspaces and access

The largest plan, and the one to defer longest. Nothing before it needs auth; it
needs everything before it to be stable.

## Problem

There is no authentication anywhere. Every mock, every OpenAPI spec at
`/m/<slug>/__spec`, and every project's configuration is world-readable at a
guessable URL. Correct for a single-owner tool by explicit design decision
(design doc §2 non-goals). Blocking for a second person, and increasingly wrong
once plan 04 stores real request bodies.

**Plan 03 ships a `MIRAGE_ADMIN_TOKEN` bearer check as a stopgap.** This plan
replaces it. The stopgap is not optional in the meantime.

## Design

### Identity — Supabase Auth

**Decided (design doc §8.1): use Supabase Auth rather than hand-rolling OAuth.**
GitHub provider, session handling and the user table come with the platform this
project already depends on for storage. Writing a second OAuth implementation
beside it would be work with no upside.

GitHub provider only, at first. The audience is developers, the repo already lives
on GitHub, and one provider means one set of edge cases. Email/password is a
support burden with no compensating benefit here.

Sessions ride Supabase's HTTP-only cookies via `@supabase/ssr`. No JWT in
`localStorage`, ever.

**What this plan still owns** — the parts no auth provider gives you: workspaces,
memberships, roles, project visibility, API tokens, and the mock endpoint's
separate authorisation model. That is the whole reason this plan survives at M
rather than disappearing.

### Row Level Security

Application checks are the first line; **RLS is the second**. Every table carrying
`workspace_id` gets a policy tying rows to the caller's memberships, so a missed
guard in one API route is a bug rather than a cross-workspace data leak.

RLS does **not** apply to the mock endpoint's own reads — those run under a service
role, because an anonymous request to a public mock has no user. That asymmetry is
deliberate and must be documented where the service key is used, since a service
key bypasses every policy.

### Model

```
user ──< membership >── workspace ──< project
                          │
                          └──< api_token
```

- A workspace is the billing and sharing boundary. Every existing project lands in
  a `default` workspace owned by the first authenticated user — the `workspace_id`
  column already exists from plan 02, which is why it exists.
- Roles: **viewer** (read config and traffic), **editor** (write config), **admin**
  (members, tokens, delete). Three roles, not five — every extra role is a
  permission matrix nobody maintains.

### Project visibility — the part specific to a mock server

| visibility | `/m/<slug>/*` | UI |
|---|---|---|
| `public` | anyone (today's behaviour) | workspace members |
| `unlisted` | anyone with the URL, absent from listings | workspace members |
| `private` | requires a project token | workspace members |

The mock endpoint's auth is **separate from the UI's**. A CI job needs to call the
mock without a browser session, and a teammate needs to see the config without
being able to call production. Conflating them is the usual mistake.

Private projects accept `Authorization: Bearer <project-token>` or
`?token=` for tools that cannot set headers. Query tokens are logged by
proxies — the UI must say so where the token is issued.

### `__spec` follows the project

`/m/<slug>/__spec` currently serves the full OpenAPI document unconditionally. It
inherits project visibility from here on. An internal API's spec is not something
to publish because the mock is convenient.

### API tokens

Workspace-scoped and project-scoped, both `mrg_` prefixed, shown once, stored as a
hash. Scopes: `read`, `write`, `mock`. Last-used timestamp and one-click revoke.
Prefix-scanning is what lets a leaked token be found in a log.

### Migration — the delicate part

1. Deploy with auth **available but not enforced**. Everything stays public.
2. First login claims the `default` workspace and its projects.
3. A banner announces the enforcement date on every page.
4. Enforcement enabled: **UI requires login; mock endpoints stay public** unless a
   project's visibility is changed by its owner.

Mock URLs must not break. Somebody's CI is calling `card-block-lost`, and silently
401-ing it because the product grew auth would be a self-inflicted incident.

## UI

- Sign-in page; workspace switcher in the sidebar; a members table.
- Settings gains **Access**: visibility, tokens, members.
- Every share affordance states what the recipient will be able to see.

## Tests

- Unauthenticated UI access redirects to sign-in once enforcement is on.
- A viewer cannot write; an editor cannot manage members; an admin can.
- A private project's mock URL: 401 without a token, 200 with one.
- A public project's mock URL is unaffected by enforcement.
- `__spec` respects visibility.
- Revoking a token takes effect on the next request.
- Cross-workspace access is denied on every API route (the enumeration test).

## Risks

| risk | mitigation |
|---|---|
| Enforcement breaks somebody's CI | Mock endpoints stay public by default; opt-in per project; announced. |
| A missed authorisation check on one route | RLS as the second line, plus a route-table test asserting every `/api/` route has a guard and failing on any unguarded addition. |
| Session fixation / CSRF | Supabase's cookie handling via `@supabase/ssr`, plus a CSRF token on state-changing requests. |
| The service-role key leaks | Server-only, never in a client bundle; a build check greps the client output for it. |
| Token leakage via query parameter | Supported but discouraged with an inline warning; `mock` scope only. |

## Rollback

`MIRAGE_AUTH=off` restores fully open access. Data is unaffected.

## Done when

Two accounts in two workspaces cannot see each other's projects, a private mock
requires its token, a public mock is unchanged, and the route-guard test covers
every API route.
