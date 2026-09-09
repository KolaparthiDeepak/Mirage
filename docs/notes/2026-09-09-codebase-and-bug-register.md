---
title: mockservers — codebase walkthrough and bug register
date: 2026-09-09
status: notes (input to the Mirage design)
scope: read-only analysis of `main` @ 2f26b7f — no code changed
---

# 1. What the system actually is

One Next.js 15 app on Vercel doing two unrelated jobs behind one deployment:

| Job | Entry point | Nature |
|---|---|---|
| **Serve mocks** | `app/m/[...slug]/route.ts` | Pure function of a build-time constant. No I/O, no state. |
| **Show mocks** | `app/(app)/**` | Read-only viewer over the same constant, plus a large amount of non-functional "Preview" UI. |

Everything hinges on one artifact: `mocks.generated.json`.

```
mocks/<slug>/{project.yaml, routes/*.yaml, openapi/*.yaml}
        │
        │  scripts/compile-cli.ts  (prebuild / predev / postinstall)
        ▼
mocks.generated.json          ← git-ignored, 52 KB today
        │
        ├── statically imported by app/m/[...slug]/route.ts   → request resolution
        ├── statically imported by app/(app)/layout.tsx       → ViewModel for the UI
        └── statically imported by app/%5F%5Fmock/*/route.ts  → health, project list
```

The compile step is the only writer. The runtime is a pure reader. That is the
central design decision and it buys real properties: a broken mock cannot reach
production (compile errors abort the build), request handling has no cold-start
I/O, and there is no database to operate. It also caps everything the product
can become, which is section 4.

## 1.1 Request path, end to end

`GET /m/card-block-lost/commands/acropolis-card-mgmt/GET_CARD/v1`

1. `route.ts:20` — Next hands over `slug = ["card-block-lost", "commands", ...]`.
2. `route.ts:23` — `bundle.projects[slug[0]]`; unknown slug → `404 {"error":"unknown project"}`.
3. `route.ts:30` — `__spec` is intercepted here (Next refuses to route an
   `__`-prefixed folder, hence also the `app/%5F%5Fmock/` URL-encoded directory).
4. `route.ts:38` — `OPTIONS` short-circuits to `204` + CORS, but **only** when
   `defaults.cors` is true.
5. `request.ts:3` — headers lowercased, query flattened, body read and
   `JSON.parse`d (failure is silent: `body` stays `undefined`).
6. `resolve.ts:28` — `basePath` stripped, then a **linear scan, first match wins**:
   method → path segments → all `match` conditions (AND).
7. `resolve.ts:38` — the chosen response body is rendered through the template
   engine; `content-type` inferred from body type, then rule headers merged over it.
8. `route.ts:45` — `defaults.delayMs` slept (`setTimeout`, capped 9000 ms).
9. `route.ts:49` — one JSON line to stdout. **This is the only record any request
   leaves anywhere.**
10. `route.ts:60` — `x-mock-rule-id` / `x-mock-matched` attached; these are what
    the UI's verdict classifier reads back.

## 1.2 The matching engine (`src/engine/`)

Small and clean. ~200 lines total.

- `match.ts:compileSegments` — path compiled once at build time into
  `literal | param(:name) | wildcard(*) | catchall(**)` segments. No regex in paths.
- `match.ts:matchPath` — index-wise comparison; `**` returns early and matches the
  rest (including zero remaining segments).
- `match.ts:evalCondition` — three targets (`jsonPath`, `header`, `query`) × five
  operators (`equals`, `notEquals`, `contains`, `regex`, `exists`), applied uniformly.
  Non-string targets are `JSON.stringify`'d before comparison, so `equals: "123"`
  matches a numeric `123`.
- `template.ts` — an allowlist, not an evaluator. Eight patterns, validated at
  **compile** time (`parseTemplate`), substituted at request time. No arithmetic,
  no member calls, no user JS. This is the right shape for the threat model.

## 1.3 The compile step (`src/compile/`)

`compileMocks()` walks `mocks/*/`, and per project:

1. Parses `project.yaml` through a **strict** Zod schema (unknown keys rejected).
2. Enforces `slug === directory name`.
3. Reads `routes/*.yaml` in filename order, appends every rule.
4. Reads `openapi/*.yaml`, expands one route per operation, appends those **after**
   the hand-written rules — which is what makes hand-written rules override
   generated ones under first-match-wins.
5. Rejects `/__` paths, duplicate ids, unknown template tokens.
6. Emits warnings for dead rules and example-less operations.

Errors abort the build (`compile-cli.ts:11`). Warnings do not, and surface at
`/__mock/health`.

## 1.4 The UI (`app/`)

Genuinely well-built: routed App Router shell, Obsidian/Paper themes, command
palette, global search, keyboard-first, careful a11y (skip link, roving tabindex,
`aria-activedescendant`), 365 passing tests. It is also, by explicit design
(`docs/specs/2026-08-30-…-obsidian-redesign-design.md` §3), mostly a demonstration.

**Real** — reads the compiled bundle, or runs a live `fetch`:
projects, endpoints, cases, request runner + Execute, verdict classification,
cURL generation, rule *display*, public URL panel, settings *display*, theme,
palette, search.

**Preview** — client state in `sessionStorage`, or nothing at all:
create project / endpoint / case (emits copy-paste YAML), rule builder, **traffic
(fabricated)**, environments, variables, scenarios, code-gen for Java/Python/Go,
Postman import, overview counters.

The honesty is commendable — nothing silently no-ops, every fake surface carries a
`PreviewBadge`. But it means the app's three most valuable-looking features —
create a mock, see your traffic, run a scenario — are all facade.

---

# 2. Bug register

Severity: **S1** breaks a user's mock silently · **S2** wrong behaviour, visible
· **S3** correctness/perf wart · **S4** note or gap, not a defect.

## Verified — reproduced against the real code

### B1 · S1 · `basePath: /` silently deletes every OpenAPI-generated route

`src/compile/compile.ts:180`

```ts
if (r.path === bp || r.path.startsWith(bp + "/")) { … } else { warnings.push(…); continue; }
```

With `bp === "/"`, the test becomes `r.path === "/" || r.path.startsWith("//")` —
false for every real path. Every generated route is dropped with a warning nobody
reads (warnings do not fail the build).

Reproduced with a two-line fixture:

```
warnings: ['svc/openapi/api.yaml: generated route "openapi:listUsers" path "/users"
            is outside basePath "/" and will not be reachable']
routes: []
```

**This is reachable straight from the product's own UI.** `CreateProjectModal`
→ Generate YAML emits, verbatim (`app/_lib/scaffold-yaml.ts:29`):

```yaml
basePath: /
```

So the documented "create a project in the browser" flow produces a project whose
OpenAPI import is guaranteed to yield zero routes. The CLI scaffold
(`scripts/new-project.mjs`) omits `basePath` entirely and is unaffected — the two
scaffolds disagree.

Fix: treat `/` as absent in the schema transform (`schema.ts:18-21`), i.e. normalise
`"/"` → `undefined`, and stop emitting it from `newProjectYaml`.

### B2 · S2 · `basePath` is not enforced — requests that omit it still match

`src/engine/resolve.ts:5-10` returns the path **unchanged** when it does not start
with `basePath`, and matching then proceeds against basePath-relative routes.

Reproduced, project with `basePath: /api` and one route `/users`:

| request path | status | matched rule |
|---|---|---|
| `/api/users` | 200 | `r1` |
| `/users` | **200** | **`r1`** ← should be 404 |
| `/anything/users` | 404 | — |

A client that forgets the base path gets a clean 200 instead of the 404 that would
have told it the URL was wrong. That defeats the reason to configure a base path
in a system whose whole job is checking request/response wiring.

Fix: `stripBasePath` should signal "outside base path" and `resolve` should return
the `notFound` response.

### B3 · S2 · Multiple OpenAPI files: only the last document survives

`src/compile/compile.ts:192` — `mergedDoc = res.mergedDoc` inside the per-file loop.
Nothing merges despite the name.

Reproduced with `api.yaml` (`/users`) + `b-second.yaml` (`/orders`):

```
routes:            [ 'openapi:listUsers', 'openapi:listOrders' ]   ← both kept
mergedDoc title:   second
mergedDoc paths:   [ '/orders' ]                                    ← first doc gone
```

Consequences: `GET /m/<slug>/__spec` serves a spec that omits half the project's
endpoints, and `src/viewer/model.ts:52` (`operationFor`) can no longer find the
operation for routes from earlier files — so their request-body examples, enum
values, `required` fills and summaries silently disappear from the UI. The routes
still work; the tooling around them degrades with no warning.

### B4 · S3 · JSON-path matching walks the prototype chain

`src/engine/match.ts:48-53` — `cur = (cur as Record<string, unknown>)[tok]` with no
own-property check.

Verified: against body `{ "a": 1 }`, the condition
`{ jsonPath: "$.__proto__", exists: true }` evaluates **true**. Same for
`$.constructor`, `$.toString`. Read-only — there is no pollution vector — but a
rule can match on a field the request never sent.

Fix: `Object.hasOwn(cur, tok)` before descending, and reject `__proto__` /
`constructor` / `prototype` tokens at compile time.

### B5 · S4 · OpenAPI paths must repeat `basePath`; hand-written paths must not

Verified against the real project. `mocks/card-block-lost/project.yaml` sets
`basePath: /commands`; its OpenAPI paths are `/commands/acropolis-card-mgmt/…`
while every `routes/*.yaml` path is `/acropolis-card-mgmt/…`. Both are correct
today, because compile strips the prefix from generated routes (compile.ts:180)
but not from hand-written ones.

This is a genuine trap: an OpenAPI spec normally carries the base path in
`servers[].url`, not in every `paths` key. A spec written that way imports to zero
routes (B1's failure mode with any non-`/` base path). Undocumented in
`docs/mock-format.md`.

### B6 · S4 · Trailing slash is ignored

Verified: `matchPath(compileSegments("/users"), "/users/")` → matched. Empty
segments are filtered out on both sides. Almost certainly desirable; undocumented,
and there is no way to opt into strict matching.

## By inspection — high confidence, not executed

### B7 · S3 · `regex` conditions recompile on every request

`src/engine/match.ts:68` — `new RegExp(cond.regex).test(actual)` runs inside the
per-request matching loop. `docs/mock-format.md:91-93` states the opposite:
"`regex` is JavaScript `RegExp` … **compiled at build time**". Build time only
*validates* it (`schema.ts:48`).

Two consequences: needless recompilation per request per condition, and a
catastrophic-backtracking pattern in a rule becomes a per-request CPU cost on a
public, unauthenticated endpoint. Precompile into the bundle, or cache by source.

### B8 · S3 · Generated cURL does not escape single quotes in header values

`src/viewer/curl.ts:85` — `-H '${k}: ${v}'`. The body one line below **is** escaped
(`.replace(/'/g, "'\\''")`); headers were missed. A `match` condition like
`{ header: "x-note", equals: "it's fine" }` produces a cURL command that will not
run when pasted.

### B9 · S3 · `OPTIONS` rules cannot be authored

`src/engine/types.ts:1` declares `OPTIONS` (and the type comment implies `HEAD`) as
valid methods, but `src/compile/schema.ts:63` enumerates only
`GET|POST|PUT|PATCH|DELETE|*`. With `cors: false`, an `OPTIONS` request therefore
falls through to `notFound` and there is no way to author a preflight response.
`docs/mock-format.md:39` documents the symptom without noting the missing capability.

### B10 · S3 · Dead-rule detection only catches exact duplicates

`src/compile/compile.ts:70-83` keys on the literal `"${method} ${path}"` string, so:

- `/users/**` placed before `/users/:id` shadows it — **no warning**.
- `*` (any method) before `GET /x` shadows it — **no warning**.
- An OpenAPI route shadowed by another OpenAPI route — never warned (the
  `!r.id.startsWith("openapi:")` guard suppresses it).

Shadowing is the single most common mock-authoring mistake and the compiler mostly
does not catch it.

### B11 · S3 · A `delayMs` near the cap can exhaust the function budget

`schema.ts:24` allows `delayMs` up to 9000; `vercel.json:6` sets
`maxDuration: 10` seconds for exactly that route. A 9 s deliberate delay plus cold
start plus body read leaves under a second of headroom, and the sleep is billed
serverless wall-clock time.

### B12 · S3 · Response header values are never validated

`app/m/[...slug]/route.ts:60-71` builds a header map from rule-authored values and
the rule id. A CR/LF or non-ISO-8859-1 character makes the `Response` constructor
throw at request time — a compile-time-clean mock that 500s in production. Validate
header names/values in `assertTemplatesValid`'s neighbourhood.

### B13 · S4 · Repeated query parameters collapse

`src/engine/request.ts:8` — `searchParams.forEach` into a flat object, last value
wins. `?tag=a&tag=b` cannot be matched, and cannot be distinguished from `?tag=b`.
Undocumented.

### B14 · S4 · `**` captures nothing

`src/engine/match.ts:22-24` returns without recording the matched remainder, so
there is no `{{request.path.*}}`-style token for a catch-all. Limits proxy-shaped
and pass-through mocks.

### B15 · S3 · The 3.2 s intro animation runs on every page load

`app/_shell/IntroSplash.tsx:7,165-168`, made per-load deliberately in commit
`36ae75a`. It rasterises a full-viewport offscreen canvas, calls `getImageData`
across it, shuffles up to 2400 particles and animates for 3.2 s + 450 ms fade,
with no click/keypress skip. `prefers-reduced-motion` is honoured, which is the
only escape. On a tool whose main job is "is my mock live?", the answer arrives
3.65 seconds late, every time.

### B16 · S4 · Every request logs its path to stdout, and that is the whole audit trail

`app/m/[...slug]/route.ts:49-58`. Bodies are correctly **not** logged, but paths
can carry identifiers, the line is unstructured for querying, retention is
Vercel's, and nothing in the product can read it back. See P1.

### B17 · S4 · Bundle-in-the-binary scaling ceiling

`mocks.generated.json` is statically imported by the mock route **and** the app
layout **and** both `__mock` routes. Every project's every rule and every response
body ships in every serverless function and in the server-rendered layout, for all
time. 52 KB at one project. This is fine now and is a wall later.

## Not bugs — verified behaviours worth writing down

- `notEquals` / `contains` / `regex` all evaluate **false** when the target is
  absent (fail-closed). Verified; correctly documented at `mock-format.md:96`.
- Path matching is case-sensitive (`/Users` ≠ `/users`). Verified.
- `**` matches zero remaining segments (`/a/**` matches `/a`). Verified.
- A malformed template like `{{request.body.a} }` is neither rejected nor
  substituted — the token regex requires `}}`, so it passes through as literal
  text. Silent, but harmless and arguably correct.
- `renderDeep` builds output objects with `Object.create(null)`, so a templated
  response cannot be prototype-polluted.

## Baseline health

`npx tsc --noEmit` clean. `npx vitest run` → **65 files, 365 tests, all passing**,
11.9 s. The test suite is real: engine tables, compile fixtures, schema edge cases,
a11y assertions, and a determinism test on the sample-traffic generator.

---

# 3. What is missing, not broken

The bug list above is small and mostly cosmetic because the implemented surface is
narrow and carefully done. The product gaps are the real story.

| Gap | Where it bites |
|---|---|
| **No traffic record** | `sample-traffic.ts` fabricates a plausible log from the project's own cases. Two full pages, a detail drawer, filters, export and "replay" are built on top of data that never happened. |
| **No writes** | Every create/edit path in the UI ends in "copy this YAML, open a PR, wait ~40 s for a redeploy". |
| **No persistence** | Environments, variables, rule drafts and scenarios live in `sessionStorage` — gone when the tab closes, invisible to anyone else. |
| **No state** | No sequenced responses, no call counters, no per-session behaviour. The `card-block-lost` workflow is steered purely by input values. |
| **No auth, no tenancy** | Every mock, every OpenAPI spec and every project's config is world-readable at a guessable URL. Fine for one owner; blocking for anything else. |
| **No schema faking** | An OpenAPI operation without an example yields an empty body and a build warning. |
| **No proxy / record** | Nothing can point at a real upstream and capture its responses — the fastest way to author a realistic mock is absent. |
| **No "why didn't it match?"** | First-match-wins over a linear scan is easy to get wrong, and the only feedback is `x-mock-matched: false`. |

Those eight lines are the agenda for the Mirage design.

---

# 4. Where each finding is handled

| finding | plan |
|---|---|
| B1, B2, B3, B4, B7, B8, B10, B12 | [01 — correctness fixes](../plans/mirage/01-correctness-fixes.md) |
| B5, B6, B11, B13, B14 | 01, documentation only |
| B9 (`OPTIONS` rules) | deferred to a format version bump |
| B15 (intro splash) | [23 — onboarding](../plans/mirage/23-onboarding.md) |
| B16 (stdout is the audit trail) | [04 — traffic recording](../plans/mirage/04-traffic-recording.md) |
| B17 (bundle-in-the-binary ceiling) | [02 — storage layer](../plans/mirage/02-storage-layer.md) |
| P1 fabricated traffic | 04 + [05 — traffic UI](../plans/mirage/05-traffic-ui.md) |
| P2 no writes | [03 — browser authoring](../plans/mirage/03-browser-authoring.md) |
| P3 `sessionStorage` state | 02 + [17 — environments and variables](../plans/mirage/17-environments-variables.md) |
| P4 no auth or tenancy | [14 — auth, workspaces, access](../plans/mirage/14-auth-workspaces.md) |
| P5 no state, no proxy, no faking | [09](../plans/mirage/09-schema-faking.md), [07](../plans/mirage/07-proxy-record.md), [10](../plans/mirage/10-stateful-mocks.md) |

Full roadmap: [`docs/specs/2026-09-09-mirage-product-design.md`](../specs/2026-09-09-mirage-product-design.md) ·
plan index: [`docs/plans/mirage/00-index.md`](../plans/mirage/00-index.md)
