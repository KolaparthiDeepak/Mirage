---
title: 16 — Flows (collections with assertions)
size: M (3–5 days)
depends on: 03
status: APPROVED — scenario removal confirmed (design doc §8, decisions 5 and 8)
---

# 16 — Flows

A saved, runnable sequence of requests with assertions. Replaces the scenario
canvas.

## Problem — and a deletion

`app/_features/scenarios/*` implements a visual scenario canvas: nodes, a toolbar,
a disabled "Run scenario" button, all backed by `sessionStorage`. It is the most
expensive Preview surface in the app and has the least evidence of demand.

**Deleting it is approved** (design doc §8, decisions 5 and 8). The same value is
rebuilt in a much cheaper shape: an ordered list of requests with assertions and
variable passing. That is what people actually run in CI. A canvas is a drawing of
a test; a list is a test.

The deletion does not have to wait for the flow runner. Removing
`app/_features/scenarios/*`, its route and its slice of `preview-store.tsx` is a
self-contained cleanup that can ship in phase 0 — it deletes a Preview surface that
promises something the product will now deliver differently.

## Design

### Shape

```yaml
name: Card block happy path
steps:
  - name: Verify customer
    request: { method: POST, path: /commands/.../VERIFY_CUSTOMER/v1,
               body: { customerId: "cust-ok" } }
    assert:
      - { status: 200 }
      - { jsonPath: $.verified, equals: true }
    capture:
      - { name: token, from: $.sessionToken }

  - name: Block the card
    request: { method: POST, path: /commands/.../BLOCK_CARD/v1,
               headers: { x-session: "{{vars.token}}" },
               body: { cardId: "{{vars.cardId}}" } }
    assert:
      - { status: 200 }
      - { matchedRule: block-card-ok }        # Mirage-specific, and the point
```

Three deliberate choices:

- **Assertions reuse the existing operator vocabulary** — `equals`, `contains`,
  `regex`, `exists` from `src/compile/schema.ts`. One mental model for matching and
  for asserting.
- **`matchedRule`** asserts *which rule served the response*, readable from the
  `x-mock-rule-id` header the runtime already sets. No other tool can assert this,
  and it is exactly what you want to pin: not just "I got a 200" but "I got the 200
  I meant to get".
- **`capture`** pulls a value from a response into `vars` for later steps. Without
  it, only trivial flows are expressible.

### Execution

Server-side, sequential, so a flow can run from CI without a browser.

```
POST /api/projects/:slug/flows/:id/run   → { runId }
GET  /api/projects/:slug/runs/:runId     → status, per-step results
```

- Each step's request goes through the normal mock path, so state (plan 10),
  faults (plan 11) and traffic (plan 04) all behave exactly as in production.
- A step's `x-mirage-session` defaults to the run id, so a flow using sequences
  does not collide with anyone else's testing. This is the payoff of plan 10's
  session design.
- A failed assertion stops the run by default; `continueOnFailure: true` per step.
- Total run capped at 60 s and 50 steps.

### Results

Per step: request sent, response received, each assertion pass/fail with expected
versus actual, the matched rule, duration. A failing step links straight to its
traffic row and its match trace (plan 06) — the whole point of the integration.

### CI

`GET /api/projects/:slug/flows/:id/run?format=junit` returns JUnit XML, so a flow
is a CI job with no client library:

```bash
curl -H "Authorization: Bearer $MIRAGE_TOKEN" \
  "$MIRAGE/api/projects/card-block-lost/flows/happy-path/run?format=junit" \
  > results.xml
```

Also exposed by the CLI (plan 19) as `mirage flow run`.

### Storage

```sql
create table flow (
  id text not null, slug text not null, name text not null,
  definition jsonb not null, created_at timestamptz not null default now(),
  primary key (slug, id)
);
create table flow_run (
  id uuid primary key, slug text not null, flow_id text not null,
  started_at timestamptz not null default now(), finished_at timestamptz,
  status text not null,            -- running | passed | failed | error
  results jsonb not null default '[]'
);
```

Runs retained 30 days.

## UI

A **Flows** page: list, editor (steps as an ordered list, drag to reorder, each
collapsible), Run, and a run history with per-step results. Building a flow from
traffic — "add these three requests as a flow" — is the fastest authoring path and
should be a button in the traffic list.

## Removals

`app/_features/scenarios/*` and `ScenarioCanvas`, `ScenarioNode`,
`ScenarioToolbar`, plus the scenario slice of `preview-store.tsx`.

## Tests

- A three-step flow runs in order and reports per-step results.
- A capture from step 1 substitutes into step 2.
- A failing assertion stops the run and names expected versus actual.
- `matchedRule` assertion fails when a different rule serves the response.
- Concurrent runs of the same flow do not share sequence state.
- JUnit output validates and reports the correct pass/fail counts.
- A run exceeding 60 s terminates with status `error`.

## Risks

| risk | mitigation |
|---|---|
| Deleting the canvas discards real work | Approved by the owner; the code stays in git history and is recoverable by commit. |
| Long flows exceed the function budget | 60 s / 50 step caps, enforced. |
| Flows become a general test framework | Assertions stay limited to the existing operator vocabulary. No scripting, ever. |

## Rollback

Hide the Flows page. The canvas is not coming back — its removal is a separate,
already-approved commit.

## Done when

The `card-block-lost` happy path runs as a flow from the UI and from `curl`,
failures point at the responsible rule, and the JUnit output drops into CI.
