---
title: 24 — Reliability and operations
size: M (3–5 days)
depends on: 02, 04
status: DRAFT
---

# 24 — Reliability and operations

The plan that makes the other twenty-three safe to run. Not a feature — the reason
features can be shipped without fear.

## Problem

Today reliability is free: no database, no state, no writes, and a build that
refuses to ship invalid config. Every plan in this roadmap spends some of that.
The spending should be deliberate and measured, not discovered in an incident.

The current failure modes are already partly unmanaged: nothing distinguishes "the
mock returned 404 because that is the configured behaviour" from "the mock returned
404 because something broke", and the only signal is an unstructured stdout line
(B16).

## 24.1 Service-level objectives

State them, then measure them:

| SLO | target | why |
|---|---|---|
| Mock endpoint availability | 99.9% | It is in someone's CI critical path |
| Mock p95 latency (excluding configured delay) | < 100 ms | It must not be the slow part of a test |
| Config propagation after save | < 10 s | Plan 02's cache TTL plus margin |
| Traffic recording completeness | > 99% | Below that, absence stops meaning anything |

The mock endpoint's availability is the only hard target. The UI can be down for
ten minutes without anyone's build breaking; the mock cannot.

## 24.2 Health and readiness

Extend `/__mock/health` — which today reports `builtAt`, `commit`, project count
and warnings — with store connectivity, cache hit rate, config version per project,
and the last successful traffic write.

Add `/__mock/ready` for deployment gating: fails while the store is unreachable or
migrations are pending, so a bad deploy never takes traffic.

## 24.3 Structured logging

Replace the single `console.log` (`route.ts:49-58`) with a small structured logger:
level, event, project, rule, duration, config version, request id.

Two rules:

- **Never log a request body or a header value.** The current code is already
  careful about this and the discipline must survive the store landing.
- **A request id** on every log line and every response (`x-mirage-request-id`), so
  a user's report is traceable to its traffic row and its logs.

## 24.4 Degradation ladder

Each new dependency gets an explicit answer to "what happens when it is down",
decided now rather than during an incident:

| dependency down | behaviour |
|---|---|
| Config store | serve the last good cached config, unbounded, log loudly, `/ready` fails |
| Traffic store | serve normally, drop the write, count the loss, surface a banner |
| Counter store (plan 10) | serve the first variant, log |
| Upstream (plan 07) | 504 with a clear body, recorded |
| Callback target (plan 12) | retry 3, mark failed, surface it |

**The mock endpoint never fails because of an internal dependency.** That is the
single reliability rule the whole roadmap is subordinate to, and every plan above
was written to honour it.

## 24.5 Load and cost

- A load test in CI against the mock route, asserting p95 stays under budget with a
  realistic rule count. It should run on every commit that touches `src/engine/` or
  `app/m/`.
- A synthetic check every 5 minutes against a canary project, alerting on failure.
- Cost tracking: traffic rows per day, database size, function invocations, with a
  projection. The free tier is a real constraint and should be watched rather than
  discovered.
- **Abuse controls on a public unauthenticated endpoint**: per-IP rate limiting
  with a generous default, and a per-project monthly request cap that returns 429
  rather than a surprise bill.

## 24.6 Backups

- Daily database snapshot, 30-day retention, and a **restore drill** performed once
  and documented. An untested backup is a belief, not a backup.
- Config export to YAML (plan 03) is a second, independent recovery path: even with
  total data loss, projects can be rebuilt from an export.

## Tests

- `/ready` fails when the store is unreachable and recovers when it returns.
- Each row of the degradation ladder has a test that forces the failure and asserts
  the behaviour.
- The load test fails when p95 regresses past budget.
- No log line contains a body or a header value (an assertion over the logger's
  call sites).
- A request id appears in the response and in the corresponding traffic row.
- The restore drill is scripted and runnable.

## Risks

| risk | mitigation |
|---|---|
| Reliability work deferred until an incident | This plan is sequenced with phase 1, not after it. |
| Degradation paths untested until they fire | Each is a test, not a paragraph. |
| Free-tier limits hit without warning | Cost tracking with projection and an alert well before the limit. |

## Rollback

Not applicable — this plan only adds observation and guards.

## Done when

Every dependency has a tested degradation path, the mock endpoint has never failed
for an internal reason under fault injection, a restore drill has been performed,
and the load test gates the engine.
