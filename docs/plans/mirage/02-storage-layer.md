---
title: 02 — Storage layer
size: M (3–5 days)
depends on: 01
status: DRAFT
---

# 02 — Storage layer

The bottleneck plan. Everything except schema faking sits behind it. It ships
**with no user-visible change** — that is deliberate, and it is what makes it safe.

## Problem

`mocks.generated.json` is imported statically into four places. That makes every
write a redeploy (~40 s), makes traffic impossible to store, and grows every
serverless bundle with every mock ever authored (B17).

## Principles

1. **The engine does not change.** `resolve(req, config)` keeps its exact
   signature. `src/engine/*` and its tests are untouched. The store's only job is
   to produce a `ProjectConfig` — the type that already exists.
2. **Ship dark.** This plan lands the store, the interface, the migration and the
   cache with the runtime **still reading the bundle** behind a flag. Flipping the
   flag is a separate, revertible commit.
3. **One interface, two drivers.** Postgres hosted, SQLite local — written that way
   from the start, or [20 — self-hosting](20-self-host.md) becomes a fork.

## The interface

`src/store/types.ts` — deliberately small. Anything not needed by an approved plan
is not on it.

```ts
export interface Store {
  // config
  getProject(slug: string): Promise<StoredProject | null>;
  listProjects(workspaceId?: string): Promise<ProjectSummary[]>;
  saveProject(p: StoredProject): Promise<void>;
  deleteProject(slug: string): Promise<void>;
  getConfigVersion(slug: string): Promise<number>;

  // traffic — plan 04
  recordTraffic(e: TrafficEntry): Promise<void>;
  queryTraffic(f: TrafficFilter): Promise<TrafficPage>;
  pruneTraffic(before: Date): Promise<number>;

  // counters — plan 10
  bumpCounter(slug: string, key: string, session: string): Promise<number>;
  resetCounters(slug: string): Promise<void>;
}
```

`StoredProject` holds exactly what `compileMocks` already produces for one project
— `ProjectConfig` plus `slug`, `configVersion`, `updatedAt`, `source`
(`"repo" | "store"`). **The stored rule shape is the shape `ruleSchema` already
validates**, so compiler, store and runtime share one type and one validator.

## Schema

```sql
create table project (
  slug            text primary key,
  workspace_id    text        not null default 'default',   -- plan 14 fills this in
  name            text        not null,
  base_path       text,
  defaults        jsonb       not null,
  openapi_doc     jsonb,
  source          text        not null default 'store',     -- 'repo' | 'store'
  config_version  bigint      not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table rule (
  id           bigserial primary key,
  slug         text   not null references project(slug) on delete cascade,
  rule_id      text   not null,                              -- author-facing id
  position     int    not null,                              -- first-match-wins order
  definition   jsonb  not null,                              -- exactly ruleSchema output
  created_at   timestamptz not null default now(),
  unique (slug, rule_id)
);
create index on rule (slug, position);
```

`position` makes rule ordering explicit and editable. Today it is implicit in
filename-then-array order — fine for files, unusable in a UI where someone needs to
drag a rule above another.

`traffic` and `counter` tables are defined in their own plans; the migration
directory and runner are created here.

## Compile-to-store sync

`compileMocks()` is unchanged. A new `scripts/sync-cli.ts` calls it and upserts
each project as `source: "repo"`. **Decided:** `card-block-lost` stays
repo-authoritative — no migration and no risk to the one mock that is actually in
use. New projects created in the browser are `source: "store"`. Repo-sourced projects are **read-only in the UI**
with an "edit in repo" link, so there is exactly one writer per project and no
merge conflict to resolve.

`npm run compile` keeps writing `mocks.generated.json` and keeps failing the build
on invalid config. Nothing about the repo workflow degrades.

## Config cache

`src/store/config-cache.ts`:

```ts
const cache = new Map<string, { config: ProjectConfig; version: number; at: number }>();
const TTL_MS = 5_000;
```

`getConfig(slug)` returns a cached entry inside the TTL, otherwise reads the store
and repopulates. Saves bump `config_version` and delete the local entry — which
only helps the instance that served the save, so the TTL is the real guarantee.
Worst case is 5 s of stale behaviour, against 40 s today.

The `ProjectConfig` handed to the engine is **compiled** from stored rules —
`compileSegments` per rule, template validation, regex precompilation — and the
compiled object is what the cache holds. Compilation happens on cache miss, never
per request.

**Cold-start budget.** A miss costs one query plus compilation. Measure it against
the real project before flipping the flag; if a miss exceeds ~50 ms, add a
stale-while-revalidate path before proceeding to [04](04-traffic-recording.md).

## Driver choice — Supabase (approved)

**Supabase Postgres.** Approved 2026-09-09; design doc §8.1 carries the reasoning.
Supabase is Postgres, so the schema above and every query in the later plans are
unchanged by the choice.

**Connection model.** Serverless functions must never hold a direct Postgres
connection — that is the classic way to exhaust a Postgres instance from Vercel.
Use one of:

- **Supavisor in transaction mode** (port `6543`) with `postgres.js`, or
- **`@supabase/supabase-js`** over PostgREST, which is plain HTTP.

Start with Supavisor plus `postgres.js`: the queries in plans 04, 13 and 21 are
real SQL with grouping and partial-index predicates, and expressing them through
PostgREST would be a fight. The `Store` interface hides the choice either way.

**The free-tier pause is a real availability risk.** A free Supabase project
pauses after about seven days of inactivity, and a paused database fails the config
read. A mock server that sits in a CI pipeline may genuinely go a fortnight between
runs. Two mitigations, the first mandatory:

1. **The cache serves stale config indefinitely on a store read error** — already
   specified below under Risks, and now load-bearing rather than defensive.
2. A keep-alive ping on the existing cron (plan 24) touches the database daily.

Paid tier removes the problem, and is the honest answer once anyone but the owner
depends on the service.

**Also arriving with Supabase**, used by later plans rather than this one:

- **Supabase Auth** — GitHub provider, sessions and the user table, which removes
  most of plan 14's hand-rolled OAuth work.
- **Row Level Security** — a second line of defence for multi-tenancy, so a missed
  check in one API route is not a cross-workspace leak. Plan 14 should use it.

Considered and rejected: Neon (equivalent for this plan, but no bundled auth) and
Turso/libSQL (better self-host symmetry, weaker Vercel ergonomics, and traffic
querying is genuinely relational). The `Store` interface keeps the door open; the
SQLite driver arrives in [20](20-self-host.md) and must pass the same conformance
suite.

## Rollout

1. Migration, `Store` interface, Postgres driver, conformance tests. No caller.
2. `sync-cli` plus a deploy hook. The store mirrors the repo; nothing reads it yet.
3. **Equivalence check in CI:** for every project, config built from the store
   deep-equals config built from the bundle, with identical rule order. This is the
   safety proof and it must be green before step 4.
4. **Separate commit:** flag `MIRAGE_CONFIG_SOURCE=store` flips the mock route and
   the app layout to the store. Revert is a flag flip.
5. Once stable, drop the static bundle import from the mock route (B17). Keep
   `MIRAGE_CONFIG_SOURCE=bundle` supported forever — it is also the offline story.

## Tests

- **Conformance suite**, run against every driver: round-trip a project, rule
  ordering by `position`, cascade delete, `config_version` monotonicity.
- **Equivalence:** `mocks/card-block-lost` from the store deep-equals from the
  bundle.
- Cache: a hit inside the TTL issues no query; a save busts; expiry refetches.
- Store unreachable: the route falls back to the last good config and logs; the
  mock route never 500s because of a config read.

## Risks

| risk | mitigation |
|---|---|
| A database outage — or a paused free-tier project — takes mocks down, which today cannot happen | Cache serves stale on read error, **unbounded**, and logs loudly. A mock serving hour-old config beats a mock serving 503. Plus the daily keep-alive ping. |
| Serverless connection exhaustion | Supavisor transaction-mode pooler; no pool held by a function. Load-test before the flag flip. |
| Config divergence between repo and store | Step 3's equivalence check runs in CI on every commit, not once. |
| Cold-start regression | Measured at step 3 and a hard gate on proceeding. |

## Rollback

Before step 4, nothing reads the store and revert is free. After step 4, flip
`MIRAGE_CONFIG_SOURCE=bundle`. The tables can stay.

## Done when

Equivalence green in CI · conformance green on the Supabase driver · the flag flip
serves `card-block-lost` byte-identically to the bundle · p95 mock latency within
10 ms of the bundle baseline.
