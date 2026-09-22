---
title: 12 — Callbacks and webhooks
size: S (1–2 days)
depends on: 02, 07 (shares the SSRF guard)
status: DRAFT
---

# 12 — Callbacks and webhooks

Mock the asynchronous half of an integration: the mock responds `202 Accepted`,
then calls you back.

## Problem

Async and event-driven workflows — the shape of the `card-block-lost` use case that
motivated this project — cannot be mocked at all today. A mock that only answers
synchronously can test half of such a flow. Payment gateways, KYC providers, card
networks and job APIs all work this way.

## Design

### Rule configuration

```yaml
- id: block-card-async
  request: { method: POST, path: /cards/:id/block }
  response: { status: 202, body: { jobId: "{{uuid}}" } }
  callback:
    url: https://my-service.test/webhooks/card-blocked
    method: POST
    delayMs: 2000
    headers: { x-signature: "{{uuid}}" }
    body:
      jobId: "{{response.body.jobId}}"     # correlates with what was returned
      cardId: "{{request.path.id}}"
      status: BLOCKED
    retry: { attempts: 3, backoffMs: 1000 }
```

### Templating

Callback bodies use the existing template engine (`src/engine/template.ts`) plus
one new namespace, `{{response.body.*}}`, resolving against the response just
returned. Correlation is the whole point of a callback — without it the caller
cannot tie the webhook to the request — so this token is required, and it is a
small, well-bounded addition to a deliberately small grammar.

### Delivery

Serverless functions die when the response is sent, so a naive `setTimeout` is
unreliable. Two mechanisms, chosen by delay:

- **≤ 5 s:** `waitUntil` on the same invocation. Simple, no infrastructure,
  covers the overwhelming majority of real callbacks.
- **> 5 s:** a `callback_queue` row plus a 1-minute cron drain. Coarse — a 30 s
  callback may fire at 60 s — and the UI must say so plainly rather than implying
  precision it does not have.

```sql
create table callback_queue (
  id uuid primary key,
  slug text not null,
  due_at timestamptz not null,
  payload jsonb not null,
  attempts int not null default 0,
  last_error text,
  state text not null default 'pending'   -- pending | sent | failed
);
create index on callback_queue (state, due_at);
```

### Safety

Outbound HTTP to a user-supplied URL is the same SSRF surface as plan 07 and
**reuses the identical guard module** — https only, DNS-resolved private-range
rejection, `redirect: "manual"`, 5 s timeout, per-project rate limit. One
implementation, one test suite, two callers. Writing a second one is how the
second one ends up weaker.

Retries are capped at 3 with fixed backoff. No exponential ladder, no dead-letter
queue: a mock server is not a message bus, and an undelivered test callback is a
visible failure, not a durability incident.

### Observability

Callbacks appear in traffic as **outbound** rows — distinct direction badge, with
target URL, status, attempt number and error. A callback that silently fails is
worse than no callback, because the user concludes their webhook handler is broken.

A **Callbacks** panel per project: pending, sent, failed, with manual retry.

## UI

Rule editor gains a **Callback** section: URL, method, delay, headers, body
template, retry. A **Test callback** button fires one immediately with sample
substitutions and shows the result inline.

## Tests

- A 2 s callback fires once, at roughly the right time, with templates resolved.
- `{{response.body.jobId}}` equals the `jobId` actually returned.
- A callback URL resolving into a private range is rejected at save.
- A failing target retries exactly 3 times, then records `failed`.
- A queued callback survives the invocation ending and is drained by the cron.
- Outbound rows appear in traffic with the correct direction and status.
- A rule without a `callback` block issues no outbound work.

## Risks

| risk | mitigation |
|---|---|
| SSRF via callback URL | Shared guard module with plan 07, identical tests. |
| Cron timing implies false precision | Documented granularity, shown in the UI next to any delay over 5 s. |
| Retry storm against a broken target | 3 attempts, per-project rate limit, auto-disable after 10 consecutive failures with a notice. |
| `waitUntil` truncated by the platform | Delays over 5 s take the queue path, never `waitUntil`. |

## Rollback

`MIRAGE_CALLBACKS=off`. Queued rows drain or expire; config stays valid.

## Done when

A `202` mock delivers a correlated callback 2 s later, failures are visible with
their error, and the SSRF suite from plan 07 passes against this caller too.
