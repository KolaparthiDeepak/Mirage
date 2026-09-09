---
title: 20 — Self-hosting
size: S (1–2 days) — reduced from M: plan 02 now builds the SQLite driver
depends on: 02, 19
status: DRAFT
---

# 20 — Self-hosting

`docker run mirage`. The whole product, one container, SQLite, no cloud.

**Decided (2026-09-09):** the SQLite driver moved into
[plan 02](02-storage-layer.md) — local development needed it immediately, not just
self-host. What is left here is purely packaging: a Dockerfile, the Vercel platform
shims, and mounting a repo read-only for CI. No new driver code.

## Why

Three audiences the hosted service cannot serve: teams whose test data cannot leave
their network, CI pipelines that want a mock server as a service container, and
anyone who wants unbounded traffic retention. It is also the most credible answer to
"what happens if you stop running this".

## Problem

The build assumes Vercel: `vercel.json`, serverless function boundaries,
`waitUntil`, `maxDuration`. None of that is fundamental — but it is load-bearing in
enough places that retrofitting later would be expensive. The `Store` interface
from plan 02 already makes the database side a driver, not a fork; this plan
closes the remaining gap, which is the platform, not the data layer.

## Design

### One image

```
docker run -p 3000:3000 -v ./data:/data ghcr.io/…/mirage
```

- Next.js `output: "standalone"`.
- **The `better-sqlite3` driver from plan 02**, pointed at `/data/mirage.db`
  instead of `.data/mirage.db`, WAL mode. One file, backed up by copying it.
- Migrations run at startup, idempotent — the same migration runner plan 02
  already built for local dev.
- No auth by default (single-tenant is the common case), with `MIRAGE_AUTH=on`
  available for a shared instance.

### The driver is already done

Plan 02 built and conformance-tested the SQLite driver for local development, so
there is nothing left to write here: `MIRAGE_DB_PATH=/data/mirage.db` at container
start is the entire integration. Concurrent writes (WAL plus SQLite's own
single-writer semantics) were already proven by that plan's conformance suite —
Mirage's write volume is mostly traffic inserts, which batch well under a single
writer regardless.

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

- The container starts, migrates (using plan 02's runner), and serves
  `card-block-lost` from a mounted repo.
- Responses are byte-identical to the hosted deployment (shared golden files).
- Traffic recording, retention pruning and counters all work through the packaged
  SQLite driver — re-running plan 02's conformance suite inside the container, not
  a new suite.
- Restart preserves data; the database file at `/data/mirage.db` is portable
  between machines.
- Read-only mount mode refuses config writes with a clear error.
- Each row of plan 24's platform-shim table (`waitUntil`, cron, `maxDuration`) has
  its self-host equivalent exercised by a test.

## Risks

| risk | mitigation |
|---|---|
| Two backends diverge in behaviour | Already plan 02's problem to hold — one conformance suite, one set of shared golden files, both in CI on every commit. This plan only re-runs them inside the container. |
| Platform shims diverge from Vercel's real behaviour | Each shim's test asserts the same externally-observable contract (a `waitUntil`'d write still happens; a cron route still fires), not the mechanism. |
| Maintenance doubles | Only the platform layer differs now — the store layer is fully shared, built once in plan 02. |
| Support burden of arbitrary environments | Document one supported configuration; others are best-effort. |

## Rollback

Stop publishing the image. The hosted service is unaffected.

## Done when

`docker run` with a mounted `mocks/` directory serves byte-identical responses to
production, the conformance suite is green on SQLite, and the container survives a
restart with data intact.
