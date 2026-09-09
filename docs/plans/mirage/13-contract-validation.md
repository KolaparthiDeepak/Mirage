---
title: 13 — Contract validation and coverage
size: M (3–5 days)
depends on: 02
status: DRAFT
---

# 13 — Contract validation and coverage

The OpenAPI document is already parsed, validated and stored. Three high-value
features fall out of it almost free.

## Problem

`src/openapi/expand.ts` reads a spec only to harvest example bodies. The schemas —
the actual contract — are discarded. So a mock can contradict the spec it was
generated from, a client can send a malformed request and get a clean 200, and
nobody can tell which operations are mocked at all.

## 13.1 Validate the mock against the spec (save time)

When a project has an OpenAPI document and a rule's method+path matches an
operation, validate the rule's response body against that operation's response
schema at save time.

- A mismatch is a **warning by default**, upgradable to a block per project
  (`contract.enforce: true`). Blocking by default would make plan 03 infuriating
  on a spec that is itself out of date, which is the common case.
- The warning names the JSON path and the expectation: *"`$.riskScore`: expected
  integer, got string"*.
- Runs on rule save and on import (plan 08), so a HAR-derived rule is checked
  against the spec it claims to implement.

A mock that lies about its own contract is worse than no mock: it makes an
integration pass in test and fail in staging, which is the exact failure this
product exists to prevent.

## 13.2 Validate the request (request time)

Validate the incoming request body and parameters against the operation schema,
and record violations on the traffic row.

- **Never changes the response.** The mock still answers per its rules. Violations
  are an annotation, not an enforcement — unless `contract.rejectInvalid: true`,
  which returns a `400` with the validation errors and is explicitly opt-in.
- Violations render as a badge in the traffic list and a panel in the detail view.
- Cost is real: schema validation per request on the hot path. Therefore
  **compile the validator once per operation and cache it** alongside the config
  (plan 02), sample above a throughput threshold, and make the whole thing a
  per-project toggle defaulting to **on for spec-backed projects, off otherwise**.

"Your client sends a string where the spec says integer" discovered in a mock,
before staging, is the highest-value thing this feature does.

## 13.3 Coverage

A **Contract** page per project:

| operation | rule | example | last called |
|---|---|---|---|
| `POST /orders` | ✓ 3 rules | ✓ | 2 m ago |
| `GET /orders/{id}` | ✓ 1 rule | ⚠ generated | never |
| `DELETE /orders/{id}` | ✗ none | — | never |

Three columns, three different kinds of gap: **unmocked** (no rule),
**unexampled** (a generated or empty body — feeds plan 09), and **unexercised**
(never called, from plan 04's traffic).

Unexercised is the interesting one. It answers "have we actually tested this path?"
which nothing else in the toolchain answers, and it costs one grouped query.

A single coverage percentage on the project overview, with the three sub-counts
underneath.

## Implementation notes

- **Validator: Ajv, approved** (design doc §8, decision 7), with the OpenAPI 3.1
  dialect. It is a real addition against the project's standing "no new heavy
  dependencies" instinct, accepted because hand-rolling JSON Schema validation is
  strictly worse in every dimension. Two conditions attached to the approval:
  it lives only in the contract module, and it is **dynamically imported** so the
  mock hot path never loads it when validation is off.
- **3.0 vs 3.1:** 3.0's `nullable` and the 3.1 dialect differ. Normalise 3.0 to
  3.1 semantics at parse time, once, in `src/openapi/`.
- Operation lookup already exists — `src/viewer/model.ts:52` `operationFor()` —
  and moves into shared code.

## Tests

- A rule whose body contradicts the response schema produces a warning naming the
  path; with `enforce: true` the save is refused.
- A request violating the request schema is annotated and still gets its normal
  response; with `rejectInvalid: true` it gets a 400 listing the errors.
- Coverage counts unmocked, unexampled and unexercised correctly against a fixture
  spec.
- Validation off → zero measurable hot-path cost.
- 3.0 `nullable` and 3.1 `type: [x, "null"]` behave identically.

## Risks

| risk | mitigation |
|---|---|
| Hot-path validation cost | Compiled once and cached, sampled, per-project toggle, benchmarked before merge. |
| Ajv bundle size in the mock function | Dynamically imported, only when the project has validation on. |
| Noisy warnings against a stale spec | Warnings by default, never blocking; dismissible per rule. |

## Rollback

`contract.validate: false` per project, or the global `MIRAGE_CONTRACT=off`.

## Done when

A contradicting rule warns at save, a violating request is annotated without
changing behaviour, and the coverage table is accurate for `card-block-lost`.
