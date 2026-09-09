---
title: 10 — Stateful mocks
size: M (3–5 days)
depends on: 02
status: DRAFT
---

# 10 — Stateful mocks

Verb 3: change how a mock behaves over time. The first genuinely stateful thing in
the system, and it must not compromise the purity of the resolver.

## Problem

Every response is a pure function of the request. "Fails twice, then succeeds" —
the shape of every retry, every polling loop, every eventual-consistency test —
cannot be expressed. Design doc §4.4; README deferred item 4.

## Design

### The rule shape gains variants

```yaml
- id: create-order
  request: { method: POST, path: /orders }
  responses:                        # replaces singular `response`
    strategy: sequence              # sequence | weighted | conditional
    variants:
      - { status: 503, body: { error: "unavailable" } }
      - { status: 503, body: { error: "unavailable" } }
      - { status: 201, body: { id: "{{uuid}}" } }
    repeatLast: true                # else cycle
```

`response` (singular) stays valid forever and is the common case. `responses` is
additive, so every existing mock is untouched and no migration is needed.

| strategy | selection |
|---|---|
| `sequence` | Nth call gets the Nth variant; then repeat the last, or cycle |
| `weighted` | `weight` per variant; deterministic per session via `hash(session + counter)`, not `Math.random()` — a test that fails must be reproducible |
| `conditional` | first variant whose `when` passes, where `when` is a `callCount` comparison |

### Sessions

All counters are keyed `(slug, ruleId, session)`. `session` comes from a
configurable header, default `x-mirage-session`, falling back to the literal
`"default"` when absent.

This is what lets two engineers test the same mock at once without consuming each
other's sequence — which is the difference between a feature people use and one
they turn off.

### Keeping the resolver pure

```
resolve(req, config)  →  { matchedRuleId, variants, ... }   pure, unchanged
        ↓
applyState(result, store)  →  picks a variant, bumps the counter    async, new
        ↓
respond
```

`src/engine/resolve.ts` gains **no async, no store, no I/O**. It returns the
matched rule's variant list; a new `src/state/apply.ts` selects. The 365 existing
tests keep passing without modification, which is the point.

A rule with a singular `response` never touches the state layer and pays nothing.

### Counter storage

```sql
create table counter (
  slug text not null,
  rule_id text not null,
  session text not null,
  n bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (slug, rule_id, session)
);
create index on counter (updated_at);        -- for TTL sweeping
```

`bumpCounter` is a single atomic `insert ... on conflict do update set n = n + 1
returning n` — correct under concurrency without a transaction.

Counters TTL after 24 h idle, swept by the same cron as traffic pruning.

**Latency:** one extra round trip, only for rules that actually use variants.
Measure it; if it materially hurts, that is the argument for adding Redis, and not
before.

### Reset

- A **Reset state** button on the project's State page.
- `POST /m/:slug/__reset` — reserved path, consistent with `__spec`, so a CI job
  can reset between test runs without a UI or a token.
- Optional `?session=` to reset one session only.

### Explicit non-goals

No cross-request data store, no "POST creates a record that GET returns". That is
a database with extra steps, and it is where mock servers go to become bad
databases. Counters and sequences cover the real cases.

## UI

A **State** page per project: rules with variants, each showing its current
counter per session, with per-rule and per-session reset. Live, so someone can
watch a sequence advance while testing.

The traffic detail (plan 05) shows which variant served a given request; the match
trace (plan 06) shows the counter value at that moment.

## Tests

- Sequence: three calls return variants 1, 2, 3; the fourth repeats or cycles.
- Two sessions advance independently.
- Weighted selection is reproducible for a fixed session and counter.
- Concurrent bumps produce no duplicate counter values.
- Reset zeroes the counter; scoped reset touches only that session.
- A rule with a singular `response` issues no counter query.
- Counter store unavailable → falls back to the first variant and logs, never 500s.

## Risks

| risk | mitigation |
|---|---|
| Latency on the hot path | Only for variant rules; measured before merge. |
| Counter table growth | Composite key bounded by rules × active sessions, TTL 24 h. |
| Surprising behaviour from a shared session default | Traffic and State pages both show the session key in use. |
| Format complexity | `response` stays the documented default; `responses` is an advanced section. |

## Rollback

`MIRAGE_STATEFUL=off` → variant rules serve their first variant. Config stays valid.

## Done when

"Fails twice then succeeds" is expressible, two sessions do not interfere, reset
works from both UI and endpoint, and non-variant rules are measurably unaffected.
