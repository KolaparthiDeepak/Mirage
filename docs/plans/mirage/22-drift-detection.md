---
title: 22 — Drift detection against upstream
size: M (3–5 days)
depends on: 07
status: DRAFT
---

# 22 — Drift detection

Answer the question that silently invalidates every mock: *is this still what the
real API does?*

## Problem

A mock is a snapshot of a belief about an API. The API changes; the mock does not.
Tests keep passing against a fiction, and the failure surfaces in staging or
production — which is precisely the outcome this product exists to prevent.

No mock tool solves this well. Combined with plan 07's upstream connection and plan
13's schema validation, Mirage is unusually well positioned to.

## Design

### The check

For each rule on a project with an `upstreamUrl`, periodically:

1. Send the rule's **example request** — already synthesised by
   `src/viewer/curl.ts:synthesizeRequest()`, which builds a request that satisfies
   the rule's own match conditions — to the upstream.
2. Compare the upstream response with the mock's.
3. Record a **drift report**.

The example-request synthesiser existing already is what makes this feature small.

### What counts as drift

Structural, not literal — comparing values would flag every timestamp and id, and
an alert that always fires is an alert nobody reads.

| severity | drift |
|---|---|
| **breaking** | status class changed · a field the mock returns is gone upstream · a field's type changed |
| **additive** | upstream returns a field the mock does not |
| **cosmetic** | values differ, shapes match (usually just data) |

Only **breaking** and **additive** are reported by default. Cosmetic is available
behind a toggle for the rare case where a value is the contract (an enum, a status
string).

Per-rule ignore paths (`$.timestamp`, `$.requestId`) for known-volatile fields.

### Safety

Sending synthesised requests to a real API is **not safe by default**:

- **Opt-in per project, and off by default.** No exceptions.
- **Safe methods only by default** — `GET` and `HEAD`. Enabling `POST`/`PUT`/
  `DELETE` requires an explicit per-rule acknowledgement, because a drift check
  that creates a real order is a genuinely bad day.
- A `x-mirage-drift-check: 1` header on every probe so the upstream can filter.
- Rate-limited, sequential, never parallel.
- Reuses plan 07's SSRF guard and timeout.
- Scheduling is explicit — manual, daily, or weekly. Never "continuously".

### Reporting

A **Drift** page per project: rules with drift, each with a side-by-side diff
(the primitive from plan 05), severity, and first-seen timestamp.

Actions per rule:

- **Accept upstream** — update the mock's response to the observed one, as a
  normal, revertible config change (plan 15).
- **Ignore this path** — add to the rule's ignore list.
- **Dismiss** — until it changes again.

Optionally an alert (plan 21) when new breaking drift appears.

### Also — spec drift

If the upstream serves an OpenAPI document at a known path, fetch and diff it
against the project's stored spec: added, removed and changed operations. Cheaper
than response probing and often catches the change earlier. Same report page.

## Tests

- An upstream with a removed field produces a **breaking** report naming the path.
- An added field produces **additive**.
- Changed values with identical shape produce nothing by default.
- Ignore paths suppress their drift.
- A non-safe method is not probed without the per-rule acknowledgement.
- "Accept upstream" produces a normal, revertible config change.
- Spec drift lists added/removed/changed operations correctly.

## Risks

| risk | mitigation |
|---|---|
| A probe mutates real data | Safe methods only by default; per-rule acknowledgement; probe header; documented loudly. |
| Noisy reports from volatile fields | Structural comparison, ignore paths, cosmetic off by default. |
| Upstream rate limits or costs | Sequential, rate-limited, explicit schedules only. |
| Synthesised requests are rejected by the real API | Report as "could not check" with the upstream's error, never as drift. |

## Rollback

Disable the schedule. Reports remain readable.

## Done when

A field removed upstream is reported as breaking within one scheduled run, and
accepting it updates the mock as a revertible change.
