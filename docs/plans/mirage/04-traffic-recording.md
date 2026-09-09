---
title: 04 — Traffic recording
size: S (1–2 days)
depends on: 02
status: DRAFT
---

# 04 — Traffic recording

The server half of verb 2. Small, self-contained, and the highest value-per-line
in the whole roadmap.

## Problem

`app/m/[...slug]/route.ts:49-58` writes one unstructured JSON line to stdout per
request. That is the entire record: not queryable, not readable by the product,
retained at Vercel's discretion (B16). Meanwhile `app/_features/traffic/` renders
a full traffic product on top of `sample-traffic.ts`, which **fabricates** a
plausible log from the project's own cases.

Fabricated telemetry in a debugging tool is worse than none. Someone will
eventually debug against it.

## Design

### What is recorded

```ts
interface TrafficEntry {
  id: string;              // uuid
  slug: string;
  at: Date;
  method: string;
  path: string;            // subpath after /m/<slug>, pre-basePath-strip
  query: Record<string, string>;
  reqHeaders: Record<string, string>;   // redacted
  reqBody: string | null;               // redacted, truncated
  status: number;
  resHeaders: Record<string, string>;
  resBody: string | null;               // truncated
  matchedRuleId: string | null;
  durationMs: number;
  warnings: string[];      // template warnings, already collected by resolve()
  clientHash: string;      // sha256(ip + daily salt), first 12 chars
  configVersion: number;   // which config served this
}
```

`configVersion` matters: without it, "this worked an hour ago" is unanswerable
once rules become editable.

### Table

```sql
create table traffic (
  id uuid primary key,
  slug text not null,
  at timestamptz not null default now(),
  method text not null,
  path text not null,
  query jsonb not null default '{}',
  req_headers jsonb not null default '{}',
  req_body text,
  status int not null,
  res_headers jsonb not null default '{}',
  res_body text,
  matched_rule_id text,
  duration_ms int not null,
  warnings jsonb not null default '[]',
  client_hash text,
  config_version bigint
);
create index on traffic (slug, at desc);
create index on traffic (slug, matched_rule_id, at desc);     -- per-rule views
create index on traffic (slug, at desc) where matched_rule_id is null;  -- unmatched inbox
```

The partial index is what makes the unmatched inbox (plan 05) instant regardless
of total volume.

### Writing — the rules

1. **After the response is sent**, in `waitUntil`. Never before, never awaited.
2. **A failed write is logged and swallowed.** Telemetry is not the contract; a
   database hiccup must never turn a 200 into a 500.
3. **Best-effort batching.** A single-request serverless invocation cannot batch,
   so this is a single insert today and a note for later.
4. **A per-project kill switch** (`recordTraffic: false`) that skips the write
   entirely, for anyone load-testing against a mock.

### Redaction — on by default

Values are replaced with `***` before storage, never after.

- **Default header denylist:** `authorization`, `proxy-authorization`, `cookie`,
  `set-cookie`, `x-api-key`, `x-auth-token`.
- **Per-project additions:** extra header names, plus JSON paths in the body
  (`$.password`, `$.card.number`).
- **A heuristic pass** flags values that look like a JWT or a long random token and
  redacts them, with a per-project opt-out.

Mock servers attract real credentials in test traffic. Storing them unredacted by
default is a mistake available exactly once.

### Truncation and retention

**The numbers below are deferred** (design doc §8, decision 6): they ship as
**configurable defaults**, not constants, and the real values are set later against
measured volume. Every one of them must be a project setting or an environment
variable from the first commit, so tuning them later is configuration rather than a
deploy.

- Bodies over **64 KB** are stored truncated with a `truncated: true` marker.
- Retention: **7 days or 10 000 rows per project**, whichever binds first.
- A daily cron (`/api/cron/prune`) calls `pruneTraffic`. Deleting by both age and
  per-project row rank keeps one noisy project from evicting a quiet one.

### Sampling

Above a configurable rate (default 100 requests/minute/project), record a
**deterministic sample** — but always keep **100% of unmatched requests and 100% of
5xx**, because those are the ones anyone is looking for. Sampling is stated in the
UI so a gap is never mistaken for silence.

## Removals

Delete `app/_features/traffic/sample-traffic.ts` and its test. The traffic UI
switches to the real query in plan 05; between the two merges it renders an empty
state, which is honest.

## Tests

- A mock request produces exactly one row with the right rule id and status.
- A traffic write that throws does not change the mock response.
- `authorization` is stored as `***`; a project-configured JSON path is redacted.
- A 100 KB body is stored truncated with the marker.
- Prune deletes past the age and count limits, and nothing inside them.
- Under sampling, an unmatched request is still recorded.

## Risks

| risk | mitigation |
|---|---|
| Write latency leaks into response time | Written after the response, in `waitUntil`; asserted by a test. |
| Traffic table growth | Retention cron plus the row cap; both are measured in plan 24. |
| A secret is stored despite redaction | Denylist plus heuristic plus per-project config, and a documented `DELETE /api/projects/:slug/traffic` panic button. |

## Rollback

`MIRAGE_RECORD_TRAFFIC=off`. The route reverts to the stdout line.

## Done when

Every request to `card-block-lost` appears in the table with the correct rule id,
p95 mock latency is unchanged within noise, redaction is verified, and
`sample-traffic.ts` is deleted.
