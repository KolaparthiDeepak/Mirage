---
title: 18 — Auto-generated API docs portal
size: S (1–2 days)
depends on: 02
status: DRAFT
---

# 18 — Auto-generated API docs portal

A shareable, read-only page per project: every endpoint, every case, a working
`curl`, and a live Try-it. Built almost entirely from parts that already exist.

## Problem

Sharing a mock today means sending a base URL and explaining the rest in chat. The
information needed to make a good page — endpoints, cases, match conditions,
example requests, `curl` — is already computed by `src/viewer/model.ts` and
`src/viewer/curl.ts` for the internal UI. It just is not reachable by someone
without access to the workspace.

## Design

### Route

`/d/<slug>` — public, or gated by project visibility once plan 14 lands. Separate
from `/p/<slug>` (the editor) so the two never have to compromise for each other,
and so a docs link cannot become an editor link by URL manipulation.

### Content

- Project name, description, base URL with a copy button.
- Endpoints grouped by path, each expandable to its cases.
- Per case: what selects it (rendered from `match` via the existing
  `app/_lib/match-summary.ts`), the example request, the response, and a `curl`.
- **Try it** — the existing `RequestBuilder`, in read-only-config mode.
- Link to `/m/<slug>/__spec` when a spec exists and visibility allows.
- Build/version stamp, so a reader knows how current the page is.

### Rendering

Server-rendered and cached, revalidated on `config_version` change. Static-shaped
output: fast, indexable when public, and cheap.

**Theme:** the existing Obsidian/Paper token system, with a lighter chrome — no
sidebar, no command palette. It is a reading page, not a tool.

### Customisation, deliberately minimal

Project description (markdown, sanitised), a logo, an accent colour, and a
per-endpoint description. Not a CMS. The value here is that it is automatic and
always current; every knob added is a knob that goes stale.

### Why this is cheap

`buildViewModel()` already produces exactly this data structure. `synthesizeRequest()`
already builds the example request from match conditions and OpenAPI schemas.
`match-summary.ts` already renders conditions in prose. This plan is largely a new
route and a stylesheet over existing functions.

## UI

Settings gains **Docs**: enable/disable, description, logo, accent, and the public
link with a copy button. A preview link from the project header.

## Tests

- The page renders every endpoint and case for `card-block-lost`.
- `curl` on the page is byte-identical to the app's generator (shared function).
- A private project's docs page 404s for an anonymous visitor.
- The page revalidates after a config change.
- Description markdown is sanitised — no script, no raw HTML injection.
- Renders correctly in both themes and at mobile width.

## Risks

| risk | mitigation |
|---|---|
| Publishing internal API shapes unintentionally | Off by default; visibility inherited from the project; the enable toggle states plainly what becomes public. |
| Stale pages | Revalidated on `config_version`, with the build stamp visible. |
| Markdown injection | Sanitised, allowlisted tags only. |

## Rollback

Disable the route. Nothing else depends on it.

## Done when

A project has a link that a colleague can open and use without an account, showing
current endpoints and a `curl` that works.
