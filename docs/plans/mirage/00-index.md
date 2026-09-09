---
title: Mirage — feature plan index
date: 2026-09-09
status: DRAFT — awaiting approval, no implementation started
design: docs/specs/2026-09-09-mirage-product-design.md
findings: docs/notes/2026-09-09-codebase-and-bug-register.md
---

# Mirage — feature plan index

Every feature below is a **separately shippable unit** with its own plan file.
Each plan states its own data model, API surface, UI, failure modes, tests,
rollback and done-criteria, so any one of them can be built, reviewed and merged
without the rest existing.

That is the point of splitting them. The single biggest risk to this project is a
six-week branch that touches storage, auth, authoring and traffic at once and can
never be safely merged. Nothing here is bigger than about a week.

---

## 1. Executive summary

### What the codebase is today

Two jobs behind one deployment, joined by one build artifact:

```
mocks/<slug>/**  →  npm run compile  →  mocks.generated.json  →  statically imported by
                                                                 · app/m/[...slug]/route.ts   (serve)
                                                                 · app/(app)/layout.tsx        (view)
                                                                 · app/%5F%5Fmock/*/route.ts   (health)
```

Request handling is a **pure function over a build-time constant**: no database,
no runtime I/O, invalid config cannot reach production because the build fails.
The engine (`src/engine/*`, ~200 lines) is clean and well tested. The UI shell is
genuinely good — routed, themed, keyboard-first, accessible, 365 passing tests.

It is also, by explicit prior design decision, **mostly a facade**. Create,
traffic, environments, variables, scenarios and code-gen are all "Preview": local
`sessionStorage` state or, in the case of traffic, fabricated data. The three
things a user most wants to do — make a mock, watch it get hit, change how it
behaves — are exactly the three that do not work.

### Baseline health

`tsc --noEmit` clean · `vitest run` → 65 files, 365 tests, all passing, 11.9 s.

### Defects found (detail in the findings note)

**Reproduced:**

| id | sev | defect |
|---|---|---|
| B1 | S1 | `basePath: /` silently drops **every** OpenAPI-generated route — and the product's own Create-project modal emits exactly `basePath: /` |
| B2 | S2 | `basePath` is not enforced: with base `/api`, a request to `/users` returns **200** instead of 404 |
| B3 | S2 | With 2+ OpenAPI files only the **last** survives as `mergedDoc`; `__spec` and the UI's examples lose the rest |
| B4 | S3 | JSON-path matching walks the prototype chain — `$.__proto__ exists: true` is always true |
| B5 | S4 | OpenAPI paths must repeat `basePath`, hand-written paths must not — undocumented asymmetry |
| B6 | S4 | Trailing slash ignored, no strict mode |

**By inspection:** B7 regex recompiled per request (docs claim build-time) · B8
cURL header values unescaped while the body is escaped · B9 `OPTIONS` rules cannot
be authored · B10 shadow detection misses `**` and `:param` overlaps · B11
`delayMs` 9000 vs `maxDuration` 10 s · B12 response headers never validated, CR/LF
→ runtime 500 · B13 repeated query params collapse · B14 `**` captures nothing ·
B15 3.2 s intro splash on every load with no skip · B16 stdout is the entire audit
trail · B17 whole bundle imported into every function, scaling ceiling.

### Where it goes

**Thesis:** *the hosted mock server that tells you why your request didn't match.*

Three verbs the product cannot do and must: **create** without a redeploy,
**see** what actually hit it, **change** how it behaves over time.

**Architecture decision:** a durable store as the live layer, with `mocks/**`
demoted from sole source of truth to a peer that can be imported from and exported
to. Behind a narrow `Store` interface, so the self-hosted SQLite build is the same
codebase, not a fork. Alternatives (GitHub-App-PR-only; self-host-only) are
written up with their trade-offs in the design doc §3.

**Non-negotiables carried forward:** resolution stays a pure function; invalid
config is rejected before it goes live; no arbitrary user JavaScript in the hosted
tier; files keep working; free at current scale.

---

## 2. The plans

### Phase 0 — correctness (do regardless of everything else)

| # | Plan | Size |
|---|---|---|
| 01 | [Correctness fixes](01-correctness-fixes.md) — B1, B2, B3, B4, B7, B8, B10, B12 | S |
| 25 | [Rename to Mirage](25-rename-to-mirage.md) | S |

### Phase 1 — make it real

| # | Plan | Size | Depends on |
|---|---|---|---|
| 02 | [Storage layer](02-storage-layer.md) | M | 01 |
| 03 | [Browser authoring](03-browser-authoring.md) | M | 02 |
| 04 | [Traffic recording](04-traffic-recording.md) | S | 02 |
| 05 | [Traffic UI](05-traffic-ui.md) | M | 04 |
| 06 | [Match trace](06-match-trace.md) | S | 04 |
| 23 | [Onboarding & first run](23-onboarding.md) | S | 03 |

### Phase 2 — make it powerful

| # | Plan | Size | Depends on |
|---|---|---|---|
| 07 | [Proxy & record from upstream](07-proxy-record.md) | M | 02, 04 |
| 08 | [Importers — HAR, Postman, cURL](08-importers.md) | M | 03 |
| 09 | [Schema faking](09-schema-faking.md) | S | 01 |
| 10 | [Stateful mocks](10-stateful-mocks.md) | M | 02 |
| 11 | [Fault injection](11-fault-injection.md) | S | 02 |
| 12 | [Callbacks & webhooks](12-callbacks-webhooks.md) | S | 02 |
| 17 | [Environments & variables](17-environments-variables.md) | S | 02 |

### Phase 3 — make it shared

| # | Plan | Size | Depends on |
|---|---|---|---|
| 13 | [Contract validation & coverage](13-contract-validation.md) | M | 02 |
| 14 | [Auth, workspaces, access](14-auth-workspaces.md) | M | 02 |
| 15 | [Config history & revert](15-config-history.md) | S | 02 |
| 16 | [Flows — collections with assertions](16-flows-runner.md) | M | 03 |
| 18 | [Auto-generated API docs portal](18-api-docs-portal.md) | S | 02 |
| 21 | [Saved views & alerts](21-alerts-saved-views.md) | S | 05 |
| 22 | [Drift detection against upstream](22-drift-detection.md) | M | 07 |

### Phase 4 — make it portable and dependable

| # | Plan | Size | Depends on |
|---|---|---|---|
| 19 | [CLI & engine package](19-cli-and-engine-package.md) | M | 02 |
| 20 | [Self-hosting](20-self-host.md) | S | 02, 19 |
| 24 | [Reliability & operations](24-reliability-and-ops.md) | M | 02, 04 |

Sizes: **S** ≈ 1–2 days · **M** ≈ 3–5 days · **L** ≈ 1–2 weeks. Estimates by an
engineer already fluent in this codebase; treat them as ordering signals, not
commitments.

---

## 3. Dependency graph

```
01 correctness
   │
   ├── 09 schema faking
   │
   └── 02 storage ─────────────┬── 03 authoring ──┬── 08 importers
                               │                  ├── 16 flows
                               │                  └── 23 onboarding
                               ├── 04 traffic rec ─┬── 05 traffic UI ── 21 saved views/alerts
                               │                   └── 06 match trace
                               ├── 07 proxy/record ── 22 drift detection
                               ├── 10 stateful
                               ├── 11 faults
                               ├── 12 callbacks
                               ├── 13 contract
                               ├── 14 auth
                               ├── 15 history
                               ├── 17 environments
                               ├── 18 docs portal
                               ├── 19 CLI ── 20 self-host
                               └── 24 reliability
```

`02` is the only true bottleneck. Everything after it is parallelisable.

---

## 4. Recommended sequencing

**If only one thing gets built:** `01` + `25` + `04` + `05` + `06`. Recording, the table,
the detail view, the unmatched inbox and the match trace. One new table, no auth,
no authoring risk. It deletes the largest untruth in the product (fabricated
traffic) and ships the one capability competitors do not have.

**If a quarter is available:** phase 0 → 1 → 2 in order, with `14 auth` pulled
forward only if a second person needs access before then.

**Never:** `14 auth` before `02 storage`, or `03 authoring` before `01` — every
authoring ramp emits `basePath`, and B1/B2 make `basePath` actively unsafe.

---

## 4a. Decisions taken (2026-09-09)

Recorded in full in the design doc §8; the consequences are already folded into
the plans below.

| decision | effect on these plans |
|---|---|
| **Store: Supabase Postgres in prod, SQLite locally** | [02](02-storage-layer.md) builds both drivers behind one `Store` interface from the start, selected by `DATABASE_URL`. Supavisor is the connection model for Postgres; the free-tier inactivity pause is a real availability risk, mitigated by an unbounded stale-cache fallback. [20](20-self-host.md) shrinks from **M to S** — it packages the already-built SQLite driver rather than writing one. |
| **Supabase Auth** | [14](14-auth-workspaces.md) drops hand-rolled OAuth and adds RLS; **L → M**. |
| **Repo stays authoritative for `card-block-lost`** | [02](02-storage-layer.md): it stays `source: "repo"`, read-only in the UI. New projects are store-native. No migration. |
| **The name is Mirage** | New [25](25-rename-to-mirage.md), in phase 0. |
| **Scenario canvas removed** | [16](16-flows-runner.md) is confirmed, not proposed. `app/_features/scenarios/*` is deleted. |
| **Ajv approved** | [13](13-contract-validation.md) proceeds, dynamically imported, confined to the contract module. |
| **Retention and quota deferred** | [04](04-traffic-recording.md) ships them as configurable defaults; the numbers are set later against measured volume. |

Still open: whether [19](19-cli-and-engine-package.md)'s `mirage dev` jumps the
queue ahead of [03](03-browser-authoring.md).

---

## 5. Ground rules for every plan

1. **One migration per plan, forward-only, additive.** No plan drops a column that
   a previous deploy still reads. Deploys must be safe with the old code running.
2. **Feature-flagged where the blast radius is the mock hot path.** A flag off must
   restore exactly today's behaviour.
3. **`src/engine/*` stays pure and synchronous.** New behaviour composes *around*
   `resolve()`, never inside it. The 365 existing tests are the regression suite
   and must keep passing untouched.
4. **Traffic writes never block or fail a response.** Telemetry is not the contract.
5. **Every plan lands its own tests** and states the one check that fails if the
   feature breaks.
6. **`npm run check` stays green** — compile, `tsc --noEmit`, eslint, vitest.
