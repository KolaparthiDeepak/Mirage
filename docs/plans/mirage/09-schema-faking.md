---
title: 09 — Schema faking
size: S (1–2 days)
depends on: 01
status: DRAFT
---

# 09 — Schema faking

Close the standing gap named in `docs/mock-format.md`: an OpenAPI operation with
no example produces an empty body and a build warning.

Independent of the storage layer — it can ship right after plan 01.

## Problem

`src/openapi/expand.ts:52-53`: no example means `body: null` plus a warning. A
spec-driven project can import cleanly and serve nothing useful, which is the
worst kind of working.

## Design

### Deterministic by construction

Generation is seeded by `hash(operationId + propertyPath)`, so the same operation
always yields the same body across builds, machines and deploys.

This is the central decision. Random fake data would make every response
non-reproducible, break the existing `looseBodyMatch` verdict logic in
`src/viewer/verdict.ts`, and make snapshot tests in consuming projects flap.
Determinism is worth more here than variety.

An optional per-project `fakerSeed` lets someone deliberately reshuffle everything.

### Rules

| schema | output |
|---|---|
| `example` / `examples` present | used verbatim — **always wins**, never faked |
| `enum` | first value |
| `default` | used |
| `format: uuid` / `date-time` / `date` / `email` / `uri` / `ipv4` | a fixed, valid, obviously-fake value of that format |
| `type: string` | `"string"`, honouring `minLength` / `maxLength` / a simple `pattern` |
| `type: integer` / `number` | within `minimum` / `maximum`, else 0 / 0.0 |
| `type: boolean` | `true` |
| `type: array` | `minItems` items, default 1 |
| `type: object` | every `required` property, plus optionals when "full mode" is on |
| `oneOf` / `anyOf` | first branch |
| `allOf` | merged |
| `nullable` | non-null |
| `$ref` | already resolved by `SwaggerParser.validate()` |

**Fake values are recognisably fake** — `"string"`, `"user@example.com"`,
`"00000000-0000-4000-8000-000000000000"`. Data that looks real gets mistaken for
real and ends up in a screenshot in a ticket.

Recursion depth cap of 5, and a cycle guard on `$ref` loops — a self-referential
schema is common and must not hang the build.

### Where it runs

At compile/import time, not per request: the generated body is stored on the rule
like any other body, so it is visible, editable and diffable. A faked body carries
`generated: true` provenance, and the UI shows a "generated from schema" badge with
an **Edit** action that clears the flag.

Per-project setting `fakeFromSchema: true | false` (default **true** for new
projects, **false** for existing ones, so nothing changes under anyone).

## Also

Use the same generator to power plan 03's "generate a body from this schema"
button, so hand-written rules on an OpenAPI-backed endpoint get the same head start.

## Tests

- A schema with an example is untouched.
- Every `format` above produces a value valid for that format.
- The same schema generates a byte-identical body across two runs and two processes.
- `required` properties are always present; optionals appear only in full mode.
- A recursive `$ref` terminates at the depth cap.
- `minItems`, `minimum`, `maxLength` are respected.
- `mocks/card-block-lost` output is unchanged (it has examples throughout).

## Risks

| risk | mitigation |
|---|---|
| Faked data mistaken for real | Values are obviously synthetic; the UI badges them. |
| A pathological schema hangs the build | Depth cap plus cycle guard plus a per-operation time budget. |
| Existing projects change output | Default off for existing projects; on only for new ones. |

## Rollback

`fakeFromSchema: false`. Behaviour returns to empty body plus warning.

## Done when

An OpenAPI project with no examples imports to fully populated, deterministic,
schema-valid bodies, and re-running the import changes nothing.
