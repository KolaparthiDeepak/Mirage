---
title: 11 — Fault injection
size: S (1–2 days)
depends on: 02
status: DRAFT
---

# 11 — Fault injection

Make the mock behave badly on purpose. The reason to own a mock server rather than
a static fixture file.

## Problem

`defaults.delayMs` is the entire failure-simulation surface: one fixed latency for
every response in a project. Real integrations fail through timeouts, intermittent
5xx, truncated bodies and p99 tail latency, and none of that is testable today.

## Design

### Configuration — project or rule level

```yaml
faults:
  enabled: true              # master switch, project-level
  latency:
    mode: jitter             # fixed | jitter | spike
    baseMs: 50
    jitterMs: 30             # jitter: base ± jitter
    spike: { percent: 1, ms: 3000 }   # spike: p99 tail
  errorRate:
    percent: 5
    status: 503
    body: { error: "service unavailable" }
  malformed:
    percent: 0               # truncated / invalid JSON body
  seed: "release-42"         # deterministic when set
```

Rule-level `faults` override project-level. Everything defaults off, so no existing
mock changes.

### Determinism is optional here, unlike plan 09

With `seed` set, selection is `hash(seed + ruleId + counter)` — a "5% error rate"
becomes exactly every twentieth call, in the same order, every run. That is what
makes a CI test using faults reproducible.

Without a seed, genuine randomness, for exploratory testing. Both are legitimate;
the difference must be visible in the UI, because a flaky CI job caused by
unseeded chaos is a bad afternoon.

### Latency and the platform ceiling

`maxDuration: 10` (`vercel.json:6`) is a hard ceiling, and B11 notes that
`delayMs: 9000` already crowds it. Therefore:

- Total injected latency is capped at **5000 ms**, validated at save.
- A spike configuration that could exceed the cap is rejected with the arithmetic
  shown, not silently clamped.
- The existing `defaults.delayMs` is folded into `faults.latency.mode: fixed` and
  kept working as an alias forever.

### Malformed responses

Three concrete modes, because "malformed" is otherwise untestable-by-guessing:

- `truncate` — body cut at a random point mid-JSON
- `invalidJson` — a deliberate syntax error injected
- `emptyBody` — `Content-Length: 0` with a 200 status

A dropped connection is **not** offered: serverless platforms do not expose it
reliably, and a feature that works locally and not in production is worse than its
absence. Documented as a self-host-only possibility (plan 20).

### Scope guard

Faults apply only when `faults.enabled` is true at project level. The State page
shows a persistent banner while faults are on, and traffic rows served by an
injected fault carry a badge. Chaos that someone forgot they enabled is a support
ticket about a bug that does not exist.

## UI

Settings gains a **Faults** tab: master toggle, latency mode with a live histogram
preview of the resulting distribution, error rate, malformed rate, seed.

A **Chaos** toggle in the top bar while faults are active, so turning them off is
never more than one click from anywhere.

## Tests

- Fixed latency: measured duration within tolerance of configured.
- Jitter stays inside `base ± jitter` across 100 samples.
- Spike at 1% produces roughly 1 in 100 slow responses across 1000 samples.
- Seeded error rate produces an identical failure sequence across two runs.
- Total latency above the cap is rejected at save with the arithmetic explained.
- `faults.enabled: false` produces zero deviation from baseline.
- `defaults.delayMs` continues to behave exactly as before.

## Risks

| risk | mitigation |
|---|---|
| Faults left on and mistaken for a real bug | Banner, per-row badge, one-click global off. |
| Latency plus cold start exceeds `maxDuration` | 5000 ms cap with headroom, validated at save. |
| Unseeded chaos makes CI flaky | Seed prominent in the UI and recommended in the docs for CI use. |

## Rollback

`MIRAGE_FAULTS=off`. Config remains valid and dormant.

## Done when

A 5% seeded error rate reproduces identically across runs, latency modes measure as
configured, and the enabled state is impossible to miss.
