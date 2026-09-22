// Plan 22 — shared shapes for drift detection. Standalone from
// src/engine/types.ts: a drift finding is never read by resolve() or by
// anything on the mock hot path.

/** One structural difference between a mock's response and the upstream's.
 *  `path` is a "$.a.b"-style pointer into the response body, or (for a spec
 *  finding) an "METHOD /path" operation key. */
export interface DriftFinding {
  severity: "breaking" | "additive" | "cosmetic";
  path: string;
  kind: "status-class-changed" | "missing-field" | "type-changed" | "new-field" | "value-changed" | "operation-added" | "operation-removed" | "operation-changed";
  detail: string;
}
