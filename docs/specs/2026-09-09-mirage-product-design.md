---
title: Mirage — product and technical design
date: 2026-09-09
status: DRAFT — awaiting approval, no implementation started
supersedes: nothing; extends docs/specs/2026-08-28-mockservers-design.md
input: docs/notes/2026-09-09-codebase-and-bug-register.md
---

# Mirage

## 1. The thesis

The current system is a **mock file server**. Mirage is a **mock server you can
drive**. The difference is three verbs the product cannot do today:

1. **Create** a mock without leaving the browser and without a 40-second redeploy.
2. **See** what actually hit it — every request, matched or not, with the reason.
3. **Change** its behaviour over time — sequences, state, faults, latency.

Everything below serves those three. The existing engine, compiler and UI shell
are good and are kept; what changes is that the write path and the observe path
stop being facades.

### Positioning

| Tool | What it is | Where Mirage differs |
|---|---|---|
| Postman Mock Server | Mocks bolted onto an API client | Mirage is mock-first: rule precedence, match tracing, stateful sequences |
| WireMock | Excellent engine, Java, self-hosted, JSON config | Mirage is hosted, zero-install, with a real UI over the same power |
| Mockoon | Great desktop app | Mirage is a shareable URL a teammate or a CI job can hit |
| Beeceptor / Mocky | Hosted and instant | Mirage keeps GitOps, OpenAPI, and per-request match explainability |

**One-line pitch:** *the hosted mock server that tells you why your request didn't
match.*

That last capability — the **Match Trace** (§4.3) — does not meaningfully exist in
any of the above and falls out almost free from the current architecture, because
resolution is already a deterministic pure function over an in-memory rule list.

## 2. Non-negotiables carried forward

These are the current design's best properties. Nothing below may break them.

- **Response resolution stays a pure function** of (request, project config). No
  network, no blocking I/O on the hot path.
- **Invalid configuration is rejected before it is live.** Today that is the build;
  after §5 it is the save.
- **No arbitrary user JavaScript**, ever, in the hosted tier. The template
  allowlist stays an allowlist.
- **Files remain a first-class source.** `mocks/**` + PR + merge keeps working for
  people who want review on their mocks; it stops being the *only* way.
- **Free to run at current scale**, and cheap at 100×.

## 3. Architecture decision — where mock config and traffic live

The single blocking decision. Three options, honestly stated.

### Option A — stay file-only, automate the PR

Browser "save" calls a GitHub App that commits to a branch and opens a PR.
Traffic comes from a Vercel log drain into an external log tool.

- **+** Zero new infrastructure, GitOps preserved perfectly, no new failure mode.
- **−** Still ~40 s to see a change. Still no traffic *in the product*. Preview
  deploys make "which version am I hitting?" genuinely confusing. Rate-limited by
  GitHub. Does not deliver verb 1 or verb 2.

### Option B — durable store as the live layer, repo as an import/export peer ✅ **recommended**

One Postgres database holds project config and request traffic. `mocks/**` becomes
a **sync source**: `compile` still runs and can push the repo state into the store;
the store can export back to YAML for a PR. The runtime reads a cached, compiled
project config instead of a bundled JSON constant.

- **+** Instant saves. Real traffic. Stateful mocks and counters become possible.
  Multi-user becomes possible. Repo workflow survives for those who want it.
- **−** A database to operate. A cache-invalidation problem. Config validity is now
  enforced at save time rather than by the build — which is *stricter* per-change
  but loses the "one green build covers everything" guarantee.
- **Cost:** the Supabase free tier covers current scale with room; the first paid
  step is ~$25/mo. Note the free tier's inactivity pause — §8.1.

### Option C — open-source, self-hostable, SQLite in a container

`docker run mirage`. Everything local, no tenancy needed, unbounded traffic retention.

- **+** No vendor limits, best story for CI and air-gapped use, natural OSS play.
- **−** Not a hosted product; loses the shareable-URL property that motivated the
  original design.

### Decision

**B now, C later, A never as an endpoint** (A survives as the *export* half of B:
"open a PR from this project's current state" is a button, not the only path).

C is not a fork of B — if the storage layer is kept behind a narrow interface
(§5.2), the same codebase runs against SQLite locally and Postgres hosted. That is
one interface, not a second product, and it is worth designing for from the start.

## 4. Feature design

Ranked. **[MVP]** ships in the first implementation phase; **[N]** is phase N.

### 4.1 Create a mock in under 60 seconds **[MVP]**

The current path is: read `docs/mock-format.md`, hand-write YAML, run `npm run
compile`, open a PR, wait for a deploy. The target path is one screen.

**Five entry ramps, ranked by how fast they get someone to a working mock:**

1. **Paste a response** — paste any JSON, name a method and path, save. Live. This
   is the 15-second path and it should be the default tab.
2. **Record from a real upstream** *(the killer feature — [2])* — set an upstream
   URL on a project; Mirage proxies anything it does not match, records the real
   request and response, and offers **"Save as mock"** on each recorded exchange.
   Authoring a realistic mock stops being writing and becomes *clicking*. This is
   how WireMock and Mockoon users actually build fixtures, and it composes
   perfectly with §4.3 because the proxied call already appears in the traffic list.
3. **Import** — OpenAPI (works today, server-side), plus **HAR**, **Postman
   collection**, and **paste a cURL command**. HAR is the highest-value addition:
   every browser devtools panel exports one, so "mock what my app just did" is a
   drag-and-drop.
4. **Generate from schema** — for OpenAPI operations with no example, synthesise a
   body from the JSON Schema with a **seeded, deterministic** generator, so the
   same operation always produces the same fake data. Closes the standing
   `docs/mock-format.md` gap and removes the "empty body + warning" outcome.
5. **Describe it** *(optional, [4])* — natural-language → rule draft, always shown
   as an editable diff before saving, never applied blind.

**Editing.** An inline editor, not a modal: match conditions as a builder with a
raw YAML/JSON escape hatch, validated as you type against the same Zod schema the
compiler uses (`src/compile/schema.ts` moves to shared code and is imported by
both). Save is blocked while invalid, with the error on the offending field.

**Immediately after every save**, the panel shows the live `curl` for the new rule
and a **Try it** button. The loop "edit → try → see it in traffic" must close
without a page navigation.

### 4.2 Traffic visibility **[MVP]**

Delete `app/_features/traffic/sample-traffic.ts` and everything downstream of it.
A fabricated log in a debugging tool is worse than no log.

**Recorded per request:** timestamp, project, method, path, query, request headers,
request body, matched rule id (or null), response status, response headers,
response body, duration, template warnings, client IP hash, environment.

**Views:**

- **Live tail** — new requests stream in as they land. Poll at 2 s to start; move
  to SSE when it is measurably worth it. Pause-on-scroll, like a log viewer.
- **Table** — filter by method, status class, matched/unmatched, rule, path,
  time window. Filters live in the URL so a view is shareable.
- **Detail** — full request and response side by side, the Match Trace (§4.3),
  **Replay** (re-issue verbatim), and **Edit & replay** (tweak, re-issue, diff).
- **Unmatched inbox** — a dedicated queue of requests that hit `notFound`. Each
  row offers **"Create a rule from this request"**, pre-filled with the method,
  path and body it actually sent. This single flow turns every integration failure
  into a two-click fix and is where §4.1 and §4.2 pay each other off.
- **Per-endpoint stats** — call count, p50/p95 latency, status distribution,
  sparkline over the retention window.

**Retention:** 7 days or 10k requests per project on the free tier, whichever binds
first; a nightly delete. Bodies truncated at 64 KB with a "truncated" marker.

**Redaction:** a per-project list of header and JSON-path patterns whose values are
stored as `***`. `authorization`, `cookie`, `set-cookie` and `x-api-key` are
redacted by default, opt-out per project. Mock servers attract real credentials in
test traffic; storing them unredacted by default would be a mistake to make once.

### 4.3 Match Trace — the differentiator **[MVP]**

For any request, show every rule that was evaluated, in order, and for each one the
first thing that disqualified it:

```
POST /commands/acropolis-card-mgmt/GET_CARD/v1        → 404 UNKNOWN_ROUTE

  1  get-card-blocked      ✗ path      /acropolis-card-mgmt/GET_CARD/v2 ≠ …/v1
  2  get-card-lost         ✓ method  ✓ path  ✗ match  $.cardId "c-99" ≠ "c-lost"
  3  get-card-default      ✓ method  ✗ path  (basePath not stripped: sent /commands/… )
  ─  no rule matched → defaults.notFound
```

Cheap to build: `resolve()` already walks the rules in order and already knows why
each one failed — it just discards that information at `resolve.ts:32-35`. The
change is to collect a trace when asked. Compute it **on demand** from the stored
request (replay through the resolver), not on the hot path, so live traffic pays
nothing.

This is the answer to the most common and most infuriating mock-server question,
and it is a direct consequence of the pure-function design already in place.

### 4.4 Dynamic and stateful behaviour **[2]**

- **Response sequences** — a rule holds an ordered list of responses; call 1 gets
  the first, call 2 the second, last one repeats or cycles. Expresses "fails twice
  then succeeds", which is how retry logic is actually tested.
- **Weighted variants** — 90% success, 10% `503`.
- **Call-count conditions** — `callCount > 3`.
- **Session scoping** — all counters keyed by a configurable header
  (default `x-mirage-session`), so two engineers testing at once do not consume
  each other's sequence. Falls back to project scope when absent.
- **Reset** — a button, and `POST /m/<slug>/__reset`, to zero all counters.
- **Fault injection** — per-rule or per-project: fixed or jittered latency, a
  latency profile with a p99 spike, an error rate, a truncated/malformed body, a
  dropped connection. Fault settings are a project-level toggle so chaos can be
  turned on for one test run and off again without editing rules.
- **Callbacks / webhooks** — after responding, fire an outbound HTTP request N ms
  later. Async and event-driven workflows are otherwise unmockable, and this is
  where `card-block-lost`-shaped orchestration ends up going.

Counters are the first genuinely stateful thing in the system: keep them in one
small table, keyed `(project, rule, session)`, TTL'd. Not in the config store.

### 4.5 Contract confidence **[3]**

With OpenAPI already parsed, three things become nearly free:

- **Validate the response** against the operation's schema at save time — refuse to
  save a mock that lies about its own contract.
- **Validate the request** against the schema at request time; record violations in
  traffic as a warning badge. "Your client is sending a string where the spec says
  integer" found in a mock, before staging.
- **Coverage** — which operations in the imported spec have no rule, no example, or
  have never been called. A progress bar against the spec is a strong nudge and a
  good project-overview widget.

### 4.6 Collaboration and tenancy **[3]**

- GitHub OAuth; workspaces; projects owned by a workspace.
- Per-project visibility: **private** (token required), **unlisted** (URL is the
  secret), **public** (today's behaviour).
- API tokens for CI. `Authorization: Bearer` on the mock URL for private projects.
- Roles: viewer / editor / admin. Audit log of config changes — who changed which
  rule, when, with a diff, and one-click revert. Config history is cheap
  (append-only rows) and is the thing people ask for the first time a shared mock
  changes under them.

### 4.7 Developer surface **[3]**

- **CLI** — `mirage dev` runs the engine locally against `mocks/**` with hot reload
  and no cloud; `mirage push` / `mirage pull` sync a project; `mirage tail` streams
  traffic to a terminal.
- **A published engine package** so the same resolver can run in-process inside a
  test suite — same rules locally and hosted, no drift.
- **Per-project subdomain** `<slug>.mirage.<domain>` when a wildcard is available;
  path-based until then.

### 4.8 Explicitly not doing

- Arbitrary user JavaScript in the hosted tier. It is the feature that turns a mock
  server into a hosting platform and an abuse target. The template allowlist plus
  §4.4 covers the real cases; anything past that is the self-hosted tier's problem.
- gRPC / GraphQL / WebSocket mocking. Real demand, wrong time — they are separate
  engines, not extensions of the HTTP matcher.
- A visual scenario canvas as currently prototyped. It is the most expensive
  surface in the Preview UI and the least evidenced demand. **Removal approved**
  (§8, decisions 5 and 8) — replaced by **saved request collections with
  assertions** ([plan 16](../plans/mirage/16-flows-runner.md)), the same value at a
  tenth of the cost.

## 5. Technical design

### 5.1 Runtime, after the change

```
request → resolve project (cache, ~5 s TTL + explicit bust on save)
        → pure resolve(req, config)                    [unchanged code]
        → apply state: sequence / counter / fault       [new, only if configured]
        → respond
        → record traffic (fire-and-forget, after the response is sent)
```

The resolver keeps its current signature and stays synchronous and pure. State and
recording sit *around* it, so `src/engine/*` and its 365 tests survive intact.

**Config cache.** Module-scope `Map<slug, {config, version, fetchedAt}>`, TTL 5 s,
plus an explicit version bump on save. A stale read costs at most 5 seconds of old
behaviour, which is 8× better than the 40 seconds a redeploy costs today.

**Traffic write.** Must never delay the response and must never fail it. Write
after the response is returned, in a `waitUntil`, batching where the platform
allows. If the write fails, the request still succeeded — traffic is telemetry,
not the product's contract.

### 5.2 Storage interface

One interface, two implementations (Postgres hosted, SQLite local) — this is what
keeps Option C from becoming a fork:

```ts
interface Store {
  getProject(slug): Promise<StoredProject | null>;
  listProjects(workspace): Promise<StoredProject[]>;
  saveProject(p: StoredProject): Promise<void>;
  saveRule(slug, rule): Promise<void>;          // validated before it reaches here
  recordTraffic(entry: TrafficEntry): Promise<void>;
  queryTraffic(filter): Promise<TrafficEntry[]>;
  bumpCounter(slug, ruleId, session): Promise<number>;
}
```

Tables: `workspace`, `project`, `rule`, `traffic`, `counter`, `config_version`.
`rule.definition` is JSONB in exactly the shape `ruleSchema` already produces — so
the compiler, the store and the runtime share one type and one validator.

### 5.3 Keeping the repo workflow

- `npm run compile` keeps working and keeps failing the build on invalid mocks.
- `mirage push` (or a deploy hook) syncs `mocks/**` into the store; a project marked
  **repo-managed** is read-only in the UI, with an "edit in repo" link.
- Every project offers **Export to YAML** → a `mocks/<slug>/` tree, and later
  **Open a PR** via a GitHub App.

Nobody is forced to migrate, and nobody is stuck in files.

### 5.4 Fix the bugs first

`docs/notes/2026-09-09-codebase-and-bug-register.md` — **B1** and **B2** are
mandatory before anything else, because both concern `basePath` and every new
authoring ramp in §4.1 will emit `basePath`. **B3**, **B4**, **B7**, **B8** are
small and belong in the same pass. **B10** (shadowed-rule detection) becomes much
more valuable once rules are editable in a UI, and should ship with §4.1.

## 6. UI plan

### 6.1 What is kept

The Obsidian shell is good and stays: sidebar + top bar + main, command palette,
global search, Obsidian/Paper themes, the keyboard model, the a11y work, the
three-pane endpoint workspace. `app/_ui/*` primitives are sound. This is a
**re-pointing**, not a redesign — the pages stop reading fake data and start
reading real data.

### 6.2 Navigation

```
Workspace
  Projects            all projects, health, last-called
  Traffic             cross-project live tail            ← real data
Project
  Overview            real counters, coverage, recent errors
  Endpoints           three-pane workspace + inline editing   ← now writable
  Traffic             live tail, unmatched inbox, match trace ← the centre of gravity
  State               sequences, counters, faults, reset      ← new
  Contract            OpenAPI coverage, violations            ← new
  Settings            general, upstream/proxy, redaction, access, history, export
```

Gone: Cases as a separate page (it belongs inside the endpoint workspace),
Variables and Scenarios as they exist (replaced per §4.8), Environments as
`sessionStorage` state (becomes a stored per-project setting).

### 6.3 The one screen that matters

The **Endpoint workspace with a docked traffic rail**. Left: endpoints. Centre:
the rule being edited. Right: the requests that hit this endpoint, live, newest
first, each expandable into its match trace.

Editing a rule and watching the next real request land against it — in one
viewport, with no navigation — is the product. Everything else is supporting
structure.

### 6.4 Empty and first-run states

The current first-run experience is a 3.2-second animation followed by a
read-only list. Replace with: a **Create your first mock** panel that is the §4.1
paste-a-response form inline, and on success, the live URL with a copy button and
a `curl` ready to paste. Time-to-first-working-mock is the metric.

Cut the intro splash to a first-visit-only, ≤800 ms, click-to-skip treatment
(B15). It is a genuinely lovely piece of canvas work; it is in the wrong place.

### 6.5 Design language

No change of direction — the Obsidian theme, the density, the mono-for-data
discipline and the restraint about motion are all correct for the audience. Three
additions the new data demands:

- **Status colour is load-bearing now.** One accessible scale for 2xx / 3xx / 4xx /
  5xx / unmatched, verified in both themes, used identically in the table, the
  sparkline and the trace.
- **A "live" state.** A quiet pulsing indicator when the tail is streaming, and an
  obvious paused state. Never animate rows themselves.
- **Diff as a first-class component.** Expected vs actual, before vs after config
  edit, recorded vs mocked. Build it once, use it in four places.

## 7. Phasing

Each phase is independently shippable and independently useful. **Every feature
below has its own plan file** — problem, data model, API, UI, failure modes,
tests, risks, rollback and done-criteria — under
[`docs/plans/mirage/`](../plans/mirage/00-index.md). Nothing in that directory is
larger than about a week, deliberately: the biggest risk to this project is a
six-week branch touching storage, auth, authoring and traffic at once that can
never be safely merged.

| Phase | Contents | Outcome |
|---|---|---|
| **0 — Correctness** | [01](../plans/mirage/01-correctness-fixes.md) — B1, B2, B3, B4, B7, B8, B10, B12; document B5, B6, B13, B14 · [25 rename to Mirage](../plans/mirage/25-rename-to-mirage.md) · delete the scenario canvas | The current product stops silently dropping OpenAPI routes and silently matching wrong base paths. Small, do it regardless of what follows. |
| **1 — Make it real** [MVP] | [02 storage](../plans/mirage/02-storage-layer.md) · [03 authoring](../plans/mirage/03-browser-authoring.md) · [04 traffic recording](../plans/mirage/04-traffic-recording.md) · [05 traffic UI](../plans/mirage/05-traffic-ui.md) · [06 match trace](../plans/mirage/06-match-trace.md) · [23 onboarding](../plans/mirage/23-onboarding.md) | The three verbs. This is where Mirage stops being a viewer. |
| **2 — Make it powerful** | [07 proxy/record](../plans/mirage/07-proxy-record.md) · [08 importers](../plans/mirage/08-importers.md) · [09 schema faking](../plans/mirage/09-schema-faking.md) · [10 stateful](../plans/mirage/10-stateful-mocks.md) · [11 faults](../plans/mirage/11-fault-injection.md) · [12 callbacks](../plans/mirage/12-callbacks-webhooks.md) · [17 variables](../plans/mirage/17-environments-variables.md) | Authoring becomes recording; behaviour becomes dynamic. |
| **3 — Make it shared** | [13 contract](../plans/mirage/13-contract-validation.md) · [14 auth](../plans/mirage/14-auth-workspaces.md) · [15 history](../plans/mirage/15-config-history.md) · [16 flows](../plans/mirage/16-flows-runner.md) · [18 docs portal](../plans/mirage/18-api-docs-portal.md) · [21 alerts](../plans/mirage/21-alerts-saved-views.md) · [22 drift](../plans/mirage/22-drift-detection.md) | More than one person can rely on it. |
| **4 — Make it portable** | [19 CLI + engine package](../plans/mirage/19-cli-and-engine-package.md) · [20 self-host](../plans/mirage/20-self-host.md) · [24 reliability](../plans/mirage/24-reliability-and-ops.md) | It works where the developer already is. |

### Recommended smallest useful slice

If only one thing gets built: **Phase 0 plus the traffic half of Phase 1** —
recording, the table, the detail view, the unmatched inbox, and the match trace,
with authoring still going through the repo. It requires one table and no auth,
it deletes the largest lie in the product (fabricated traffic), and it delivers the
one capability competitors do not have. Browser authoring can follow once the
storage layer has proven itself on the lower-risk write path.

## 8. Decisions

Approved 2026-09-09.

| # | question | decision |
|---|---|---|
| 1 | Option B — a durable store as the live layer | **Yes.** |
| 2 | Which store | **Supabase (Postgres) in production.** See §8.1. |
| 3 | Does the repo stay authoritative for `card-block-lost` | **Yes** — it stays `source: "repo"`, read-only in the UI. New projects are store-native. No migration, no risk to the working mock. |
| 4 | Name | **Mirage.** Rename the repo, README, package, health payload and docs in phase 0 — [plan 25](../plans/mirage/25-rename-to-mirage.md). |
| 5, 8 | The scenario canvas | **Remove it.** `app/_features/scenarios/*` is deleted; [plan 16](../plans/mirage/16-flows-runner.md) replaces it with a list-shaped flow runner. |
| 6 | Retention and quota numbers | **Deferred.** The placeholders (7 days / 10k rows / 64 KB) ship as configurable defaults; the real numbers are set later against measured volume. |
| 7 | Ajv as a dependency | **Yes** — confined to the contract module (plan 13) and dynamically imported, so the mock hot path never loads it. |

Still open:

9. **`mirage dev` before or after hosted authoring?** [Plan 19](../plans/mirage/19-cli-and-engine-package.md)'s
   local server is arguably the highest value-per-line item in the roadmap and
   depends only on code that already exists. It could jump the queue ahead of
   [plan 03](../plans/mirage/03-browser-authoring.md).

### 8.1 Supabase — consequences

Supabase is Postgres, so §5.2's schema and every plan that writes SQL are
unchanged. Four things about it do change the surrounding plans, and two are
warnings rather than benefits.

**In its favour:**

- **Supabase Auth largely replaces [plan 14](../plans/mirage/14-auth-workspaces.md)'s
  hand-rolled OAuth.** GitHub provider, sessions, and the user table come with the
  platform. Plan 14 shrinks to workspaces, roles, project visibility and API
  tokens — the parts that are genuinely Mirage-specific. That is the single largest
  effort saving in this decision, and it moves plan 14 from **L** toward **M**.
- **Row Level Security** is a real second line of defence for multi-tenancy: a
  missed authorisation check in one API route does not become a cross-workspace
  data leak. Plan 14 should use it rather than rely on application checks alone.
- Bundled storage, realtime and a SQL editor, none of which are needed now, all of
  which are there if a plan later wants them.

**Against, and both must be handled:**

- **Free-tier projects pause after ~7 days of inactivity.** A paused database
  means the config read in [plan 02](../plans/mirage/02-storage-layer.md) fails.
  For a mock server that sits in someone's CI and may go a fortnight between runs,
  that is a genuine availability problem, not a footnote. Two mitigations, and the
  first is mandatory: plan 02's cache **must serve stale config indefinitely on a
  store read error** (it already specifies this), and a keep-alive ping from the
  existing cron keeps the project awake. Paid tier removes the issue and is the
  honest answer once anyone else depends on the service.
- **Connection model.** Serverless functions must not open direct Postgres
  connections. Use the **Supavisor pooler in transaction mode** (port 6543) or
  `@supabase/supabase-js` over PostgREST. This replaces plan 02's "Neon HTTP
  driver" note; the conclusion — no pool held by a serverless function — is
  identical.

Neither changes the `Store` interface, which is the point of having one. The
SQLite driver for [plan 20](../plans/mirage/20-self-host.md) is unaffected.

---

## 9. Per-feature plans

Twenty-five plans, each independently shippable, in
[`docs/plans/mirage/`](../plans/mirage/00-index.md). The index carries the full
dependency graph, the sizing, the recommended sequencing, and the ground rules
every plan obeys (forward-only migrations, feature flags on the hot path, the
engine stays pure, traffic writes never block a response, one runnable check per
plan, `npm run check` stays green).
