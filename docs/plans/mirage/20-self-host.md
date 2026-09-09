---
title: 20 — Self-hosting
size: M (3–5 days)
depends on: 02, 19
status: DRAFT
---

# 20 — Self-hosting

`docker run mirage`. The whole product, one container, SQLite, no cloud.

## Why

Three audiences the hosted service cannot serve: teams whose test data cannot leave
their network, CI pipelines that want a mock server as a service container, and
anyone who wants unbounded traffic retention. It is also the most credible answer to
"what happens if you stop running this".

## Problem

The build assumes Vercel: `vercel.json`, serverless function boundaries, Neon's
HTTP driver, `waitUntil`. None of that is fundamental — but it is load-bearing in
enough places that retrofitting later would be expensive. Plan 02's `Store`
interface exists specifically so this is a driver, not a fork.

## Design

### One image

```
docker run -p 3000:3000 -v ./data:/data ghcr.io/…/mirage
```

- Next.js `output: "standalone"`.
- **SQLite** at `/data/mirage.db`, WAL mode. One file, backed up by copying it.
- Migrations run at startup, idempotent.
- No auth by default (single-tenant is the common case), with `MIRAGE_AUTH=on`
  available for a shared instance.

### What the SQLite driver must handle

- `jsonb` becomes `text` with JSON functions. Query shapes in plans 04 and 13 must
  be validated against SQLite's JSON support, not assumed.
- `bigserial` becomes `integer primary key autoincrement`.
- Concurrent writes: WAL plus a single-writer queue. Mirage's write volume is
  traffic inserts, which batch well.
- **The conformance suite from plan 02 is the specification.** A driver that passes
  it is correct by definition; that is why the suite exists before the driver does.

### Platform shims

| Vercel | self-host |
|---|---|
| `waitUntil` | a fire-and-forget promise with an unhandled-rejection guard |
| cron routes | `node-cron` in-process |
| `maxDuration` | none — long delays and callbacks are actually more capable here |
| edge config/env | `.env` and a config file |

One `src/platform/` module with two implementations, chosen at startup. Two
implementations, tested twice, and the seam is the same seam the store already has.

### Mounting the repo

```
docker run -v ./mocks:/mocks:ro -e MIRAGE_MOCKS_DIR=/mocks mirage
```

Mounts a repo read-only and serves it directly — file-defined mocks, no database
write, no UI editing. This is the CI mode, and it is the fastest path to value for
someone evaluating the project.

### Feature parity

Everything except GitHub OAuth (needs a callback URL) and hosted-specific
niceties. **Faults gain the dropped-connection mode** explicitly excluded in plan
11, because a long-lived Node process can actually do it.

## CI usage

```yaml
services:
  mocks:
    image: ghcr.io/…/mirage
    volumes: [./mocks:/mocks:ro]
    env: { MIRAGE_MOCKS_DIR: /mocks }
```

Point the application under test at `http://mocks:3000/m/<slug>`. That is the whole
integration, and it is the pitch.

## Tests

- The SQLite driver passes the full plan 02 conformance suite.
- The container starts, migrates, and serves `card-block-lost` from a mounted repo.
- Responses are byte-identical to the hosted deployment (shared golden files).
- Traffic recording, retention pruning and counters all work on SQLite.
- Restart preserves data; the database file is portable between machines.
- Read-only mount mode refuses config writes with a clear error.

## Risks

| risk | mitigation |
|---|---|
| Two backends diverge in behaviour | Conformance suite plus shared golden files, both in CI on every commit. |
| SQLite JSON query gaps | Validate plan 04 and 13 query shapes on SQLite *before* committing to this plan. |
| Maintenance doubles | Only the store and platform layers differ. Everything above them is shared code. |
| Support burden of arbitrary environments | Document one supported configuration; others are best-effort. |

## Rollback

Stop publishing the image. The hosted service is unaffected.

## Done when

`docker run` with a mounted `mocks/` directory serves byte-identical responses to
production, the conformance suite is green on SQLite, and the container survives a
restart with data intact.
