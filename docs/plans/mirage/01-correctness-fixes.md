---
title: 01 — Correctness fixes
size: S (1–2 days)
depends on: nothing
status: DRAFT
---

# 01 — Correctness fixes

Ship this regardless of whether any other plan is approved. It is small, it is
pure bug-fixing, and two of the defects actively corrupt mocks today.

## Problem

Eight defects from `docs/notes/2026-09-09-codebase-and-bug-register.md`, two of
them severe. B1 and B2 are prerequisites for every authoring feature, because both
concern `basePath` and every new create-a-mock ramp emits `basePath`.

## Changes

### B1 — `basePath: /` drops every OpenAPI route  *(S1)*

`src/compile/schema.ts:18-21` — normalise `"/"` to `undefined` in the transform:

```ts
basePath: z.string().startsWith("/")
  .transform((s) => (s.endsWith("/") && s.length > 1 ? s.slice(0, -1) : s))
  .transform((s) => (s === "/" ? undefined : s))
  .optional(),
```

`app/_lib/scaffold-yaml.ts:29` — stop emitting `basePath: /` from
`newProjectYaml`. Omit the key entirely, matching `scripts/new-project.mjs`.

Also emit a **compile error, not a warning**, when an OpenAPI file contributes
zero routes because every path fell outside `basePath` — silence is what let this
survive. A warning nobody reads is not a diagnostic.

### B2 — `basePath` not enforced at request time  *(S2)*

`src/engine/resolve.ts:5-10` — `stripBasePath` must distinguish "stripped" from
"outside":

```ts
function stripBasePath(path: string, basePath: string | undefined): string | null {
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(basePath + "/")) return path.slice(basePath.length);
  return null;                       // outside the base path
}
```

`resolve()` returns the `notFound` response immediately on `null`, with
`matchedRuleId: null`.

**This is a behaviour change** and could break a caller relying on the loose
behaviour. Mitigate by shipping it with a build-time warning listing every project
that has a `basePath` set, and by noting it in the changelog. It is still the
right change: a mock server that accepts the wrong URL is lying to its user.

### B3 — only the last OpenAPI document survives  *(S2)*

`src/compile/compile.ts:192` — accumulate instead of overwrite:

```ts
mergedDoc = mergeOpenApiDocs(mergedDoc, res.mergedDoc);
```

`mergeOpenApiDocs` is a shallow, conservative merge: union of `paths`, union of
`components.*`, first document wins on `info` and the `openapi` version. A
collision on a `paths` key or a `components` key is a **compile error** naming
both files — silently picking one is exactly the bug being fixed.

### B4 — prototype-chain reads in JSON-path matching  *(S3)*

`src/engine/match.ts:48-53`:

```ts
for (const tok of tokens) {
  if (cur == null || typeof cur !== "object") return undefined;
  if (!Object.hasOwn(cur, tok)) return undefined;
  cur = (cur as Record<string, unknown>)[tok];
}
```

Plus a compile-time rejection of `__proto__`, `constructor` and `prototype` as
path tokens, so authors get told rather than getting a silent `undefined`.

### B7 — regex recompiled per request  *(S3)*

Two parts. Compile the pattern once and reuse it: a module-level
`Map<string, RegExp>` in `match.ts`, populated lazily and keyed by pattern source.
A cache is preferable to storing a `RegExp` in the bundle, which is not
JSON-serialisable.

Then fix the documentation: `docs/mock-format.md:91-93` currently claims
compilation happens at build time. After this change the claim is true in effect.

Guard against catastrophic patterns at **compile** time with a simple heuristic —
reject nested unbounded quantifiers such as `(a+)+` and `(a*)*` with a clear
error. This is not a complete ReDoS defence and the plan should say so; it catches
the accidental case, which is the realistic one for a repo-authored pattern.

### B8 — cURL header values unescaped  *(S3)*

`src/viewer/curl.ts:85` — reuse the escaping the body already has:

```ts
const shq = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
for (const [k, v] of Object.entries(headers)) parts.push(`  -H ${shq(`${k}: ${v}`)}`);
```

### B10 — shadow detection misses overlapping paths  *(S3)*

`src/compile/compile.ts:70-83` — replace exact-string keying with a real
reachability check. For each rule, test whether any *earlier* rule with no `match`
conditions would match every request this rule can match:

- earlier method is `*` or equal, **and**
- earlier segments subsume these segments: a `literal` subsumes only an identical
  literal, `param` and `wildcard` subsume any single segment, `catchall` subsumes
  everything from its position onward.

This catches `/users/**` before `/users/:id`, and `*` before `GET /x`. Keep the
existing suppression for a hand-written rule intentionally overriding an
`openapi:` one, and extend the warning to openapi-shadows-openapi.

Table-driven test with the subsumption matrix — this is the only piece of new
logic in this plan and needs the most tests.

### B12 — response headers never validated  *(S3)*

Extend `assertTemplatesValid` (`compile.ts:49`) to validate header **names**
against the HTTP token grammar, and to reject any header **value** containing a
control character (below 0x20, or 0x7f). A CR or LF in a rule-authored header
currently becomes a runtime 500 from a mock that compiled clean.

## Also — documentation, no code

- `docs/mock-format.md`: document that OpenAPI paths must include `basePath` while
  hand-written paths must not (B5), that trailing slashes are ignored (B6), that
  repeated query parameters collapse to the last value (B13), and that `**`
  captures nothing (B14).
- Note the `delayMs` 9000 against `maxDuration` 10 s interaction (B11) and lower
  the schema cap to **5000**, which leaves real headroom.

## Deferred out of this plan

- **B9** (`OPTIONS` rules unauthorable) — a format change; belongs with a format
  version bump.
- **B15** (intro splash) — covered by [23 — onboarding](23-onboarding.md).
- **B16 / B17** (stdout audit trail, bundle ceiling) — the premise of
  [02](02-storage-layer.md) and [04](04-traffic-recording.md).

## Tests

- `basePath: /` fixture → OpenAPI routes present, no warning. (B1)
- `basePath: /api`, route `/users`: `/api/users` → 200, **`/users` → 404**. (B2)
- Two OpenAPI files → `mergedDoc.paths` contains both; colliding key → error. (B3)
- Body `{a:1}`, `$.__proto__ exists:true` → **false**. (B4)
- Header value containing a single quote → generated cURL survives `bash -n`. (B8)
- Subsumption table: `/users/**` before `/users/:id` → warning. (B10)
- Header value containing CR or LF → compile error. (B12)

## Risks

| risk | mitigation |
|---|---|
| B2 breaks a caller depending on loose base-path matching | Only `card-block-lost` exists, and its callers use the full path. Ship with a build warning listing affected projects. |
| B10's subsumption logic over-warns and becomes noise | Warnings only, never errors. Tune against the real project before merging. |
| B3's merge rejects a spec pair that used to "work" | It only ever half-worked. The error names both files and the colliding key. |

## Rollback

Pure revert. No data, no migration, no flag.

## Done when

`npm run check` green; the seven tests above pass; `mocks/card-block-lost`
compiles with the same route count as before; `docs/mock-format.md` describes the
actual behaviour.
