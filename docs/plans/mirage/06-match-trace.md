---
title: 06 — Match trace
size: S (1–2 days)
depends on: 04
status: DRAFT
---

# 06 — Match trace

The differentiator. Small, because the architecture already did the hard part.

## Problem

Resolution is first-match-wins over a linear scan of rules whose ordering is
implicit. When the wrong response comes back — or none — the only feedback is
`x-mock-matched: false` and a 404 body. Every mock server has this problem;
none of them solve it well.

`resolve()` at `src/engine/resolve.ts:31-40` already walks the rules in order and
already knows precisely why each one failed. It discards that at the `continue`.

## Design

### Output

```
POST /commands/acropolis-card-mgmt/GET_CARD/v1        → 404 UNKNOWN_ROUTE
config v41 · 3 rules evaluated · 0.4 ms

  1  get-card-blocked   ✗ path    /acropolis-card-mgmt/GET_CARD/v2 ≠ .../v1
  2  get-card-lost      ✓ method  ✓ path   ✗ match
                                           $.cardId  "c-99" ≠ "c-lost"
  3  get-card-default   ✓ method  ✗ path   (basePath not stripped — you sent /commands/...)
  ─  no rule matched → defaults.notFound
```

Each row stops at the **first** disqualifying check, which is what makes the output
short enough to read. A matching run shows the winner and every rule skipped above
it — that is the answer to "why did I get the wrong response", which is the more
common and more confusing failure.

### Implementation

A parallel `explain()` in `src/engine/explain.ts`, not a flag threaded through
`resolve()`:

```ts
export function explain(req: ParsedRequest, project: ProjectConfig): RuleTrace[];
```

Two functions that must agree is a real risk, so it is closed by test rather than
by structure: a **property test** asserts that for a corpus of requests,
`explain()`'s winner is always `resolve()`'s `matchedRuleId`. That is cheaper and
clearer than making the hot path carry an optional trace parameter, and it keeps
`resolve()` exactly as it is — pure, synchronous, allocation-free.

### Cost

**Computed on demand, never on the hot path.** The trace is derived from the stored
`TrafficEntry` by re-running `explain()` against the config version that served it.
Live traffic pays nothing.

`configVersion` from plan 04 is what makes this honest: a trace for a request from
before an edit uses the config that actually served it, so "it worked an hour ago"
becomes answerable rather than arguable.

### Diagnostic hints

Beyond mechanical comparison, name the traps this codebase has already produced:

- path differs only in `basePath` → *"basePath not stripped — you sent `/commands/...`"* (B2)
- path differs only in case → *"paths are case-sensitive"* (B6 note)
- path differs only in a trailing slash → *"trailing slashes are ignored, this is not the difference"*
- body was not valid JSON → *"body did not parse as JSON, every `jsonPath` condition fails"*
- an earlier unconditional rule matched → *"rule N above matches everything this rule matches"* (B10)
- a `notEquals` / `contains` / `regex` on an absent field → *"fails closed when absent; use `exists: false`"*

Six hints derived directly from the findings note. Each converts a confusing
outcome into a sentence.

### Surfaces

- Inline in the traffic detail view (plan 05).
- On the unmatched inbox row, collapsed to the single most likely reason.
- In the runner, after Execute — the natural next step from
  `src/viewer/verdict.ts`'s existing hit/divert/nomatch classification, which
  already knows a request landed on the wrong rule but cannot say why.
- `GET /api/projects/:slug/traffic/:id/trace` for CLI and CI use (plan 19).

## Tests

- **Property test:** across a request corpus, `explain()` winner equals
  `resolve()` `matchedRuleId`. This is the plan's load-bearing test.
- Each hint fires on its own fixture and does not fire on a near-miss.
- A trace against an older `configVersion` reflects that older config.
- Trace generation touches no network and does not mutate the config.

## Risks

| risk | mitigation |
|---|---|
| `explain()` and `resolve()` drift apart | The property test runs in CI on every commit; a divergence fails the build. |
| Trace output is overwhelming on a 200-rule project | Collapse to the winner plus the three nearest misses, with "show all". |

## Rollback

Hide the UI entry points. Nothing else depends on it.

## Done when

Every traffic row explains itself, the property test is green, and all six hints
have a fixture.
