---
title: 05 — Traffic UI
size: M (3–5 days)
depends on: 04
status: DRAFT
---

# 05 — Traffic UI

The user half of verb 2, and the centre of gravity of the product.

## Problem

The traffic pages exist and are well built — table, drawer, filters, export,
replay — on top of fabricated data. This plan re-points them at real rows and adds
the three views that make traffic a workflow rather than a log.

## The four views

### 1. Live tail

New requests appear as they land. **Poll at 2 s** to start — a `GET
/api/projects/:slug/traffic?since=<cursor>` returning only new rows. SSE is the
obvious upgrade and is deliberately not in this plan: polling is ~20 lines,
survives serverless cold starts, and is trivially debuggable. Revisit when someone
complains, not before.

Pause on scroll-up, resume on scroll-to-top, like every log viewer worth using.
A quiet pulse indicates streaming; a clear badge indicates paused.

### 2. Table

Filters: method, status class, matched/unmatched, rule id, path substring, time
window. **Filters live in the URL** so a view is a shareable link — the existing
`EndpointWorkspace` already uses this pattern for `?e=` and `?c=`.

Columns: time, method, path, status, rule, duration. Virtualised past ~200 rows.

### 3. Detail

Request and response side by side, headers and body, with redacted values shown as
`***` and labelled so nobody thinks the value was empty. Actions:

- **Replay** — re-issue verbatim through the existing runner.
- **Edit and replay** — open in `RequestBuilder` pre-filled.
- **Match trace** — plan 06, rendered inline here.
- **Create a rule from this request** — the payoff, below.
- **Copy as cURL** — reuse `src/viewer/curl.ts`.

### 4. Unmatched inbox

A dedicated queue of requests that hit `defaults.notFound`, newest first, backed by
the partial index from plan 04. Each row offers **Create a rule from this request**,
which opens plan 03's editor pre-filled with the method, path and a `match` block
derived from the body it actually sent.

This is the flow that makes the two features pay for each other: an integration
failure becomes a two-click fix instead of a spelunking session. It is the single
most-used screen in the finished product, and it should be the project's default
tab when the unmatched count is non-zero.

## Stats

On the project overview, replacing the `—` placeholders in
`app/_features/overview/ProjectStats.tsx`:

- requests in the window, matched vs unmatched split
- p50 / p95 duration
- status-class distribution
- a sparkline of volume with unmatched overlaid
- top 5 unmatched paths — usually one typo, immediately visible

All from one grouped query, cached 30 s. Numbers on this page must be real or
absent; the current code is scrupulous about that and the standard holds.

## Design language additions

Three things the new data demands (design doc §6.5):

1. **Status colour becomes load-bearing.** One accessible scale for 2xx / 3xx /
   4xx / 5xx / unmatched, verified in both Obsidian and Paper, used identically in
   the table, the sparkline and the trace. `app/_ui/StatusCode.tsx` is the seed.
2. **A live state.** A quiet pulse when streaming, an obvious paused state. Never
   animate rows — motion on arriving data makes a log unreadable.
3. **Diff as a first-class primitive.** Expected vs actual, before vs after edit,
   recorded vs mocked. Built once here, reused in plans 15, 16 and 22.

## Export

Keep the existing JSON export, add **HAR**. A HAR file drops into browser devtools
and into every HTTP tool, and it round-trips with plan 08's HAR importer — export
from one project, import into another.

## Tests

- The table renders real rows and filters correctly on each field.
- Filters round-trip through the URL.
- The tail appends only new rows and does not duplicate across polls.
- Redacted values render as `***` with the redaction label.
- The unmatched inbox shows only `matchedRuleId === null`.
- "Create a rule from this request" pre-fills method, path and body.
- HAR export validates against the HAR 1.2 schema.

## Risks

| risk | mitigation |
|---|---|
| Polling cost at idle | 2 s only while the tab is visible and the tail is active; `document.visibilitychange` pauses it. |
| Large bodies bloat the detail view | Lazy-load bodies on expand, not in the list query. |
| Table performance at 10k rows | Server-side pagination plus virtualisation; the retention cap bounds the worst case. |

## Rollback

Revert to the empty state. No data is affected.

## Done when

A request made by `curl` appears in the tail within 2 s, its detail matches what
was sent, an unmatched request is one click from a working rule, and no fabricated
data remains anywhere in the app.
