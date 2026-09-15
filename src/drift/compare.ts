// Plan 22 — structural drift comparison. Comparing literal values would flag
// every timestamp and generated id; comparing shape (presence + type) keeps
// the signal to "the contract changed", not "the data changed".
import type { DriftFinding } from "./types";

function typeOf(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function childPath(prefix: string, key: string): string {
  return `${prefix}.${key}`;
}

function walk(
  mockValue: unknown,
  upstreamValue: unknown,
  path: string,
  ignorePaths: Set<string>,
  compareCosmetic: boolean,
  findings: DriftFinding[],
): void {
  if (ignorePaths.has(path)) return;

  const mockType = typeOf(mockValue);
  const upstreamType = typeOf(upstreamValue);

  if (mockType !== upstreamType) {
    findings.push({ severity: "breaking", path, kind: "type-changed", detail: `${mockType} -> ${upstreamType}` });
    return;
  }

  if (mockType === "object") {
    const mockObj = mockValue as Record<string, unknown>;
    const upstreamObj = upstreamValue as Record<string, unknown>;
    for (const key of Object.keys(mockObj)) {
      const path2 = childPath(path, key);
      if (ignorePaths.has(path2)) continue;
      if (!(key in upstreamObj)) {
        findings.push({ severity: "breaking", path: path2, kind: "missing-field", detail: `"${key}" is present in the mock but not upstream` });
        continue;
      }
      walk(mockObj[key], upstreamObj[key], path2, ignorePaths, compareCosmetic, findings);
    }
    for (const key of Object.keys(upstreamObj)) {
      if (key in mockObj) continue;
      const path2 = childPath(path, key);
      if (ignorePaths.has(path2)) continue;
      findings.push({ severity: "additive", path: path2, kind: "new-field", detail: `"${key}" is present upstream but not in the mock` });
    }
    return;
  }

  if (mockType === "array") {
    const mockArr = mockValue as unknown[];
    const upstreamArr = upstreamValue as unknown[];
    // Compare only a representative element (index 0) — comparing every
    // index would flag an ordinary length difference as drift.
    if (mockArr.length > 0 && upstreamArr.length > 0) {
      walk(mockArr[0], upstreamArr[0], `${path}[0]`, ignorePaths, compareCosmetic, findings);
    }
    return;
  }

  if (compareCosmetic && mockValue !== upstreamValue) {
    findings.push({ severity: "cosmetic", path, kind: "value-changed", detail: `${JSON.stringify(mockValue)} -> ${JSON.stringify(upstreamValue)}` });
  }
}

export interface CompareOptions {
  ignorePaths?: string[];
  compareCosmetic?: boolean;
}

/** Compares a mock's response with what the upstream actually returned.
 *  A status-class change (2xx vs 4xx, say) makes body comparison meaningless
 *  — the shapes are expected to differ — so it short-circuits there. */
export function compareResponses(
  mock: { status: number; body: unknown },
  upstream: { status: number; body: unknown },
  opts: CompareOptions = {},
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  const mockClass = Math.floor(mock.status / 100);
  const upstreamClass = Math.floor(upstream.status / 100);
  if (mockClass !== upstreamClass) {
    findings.push({
      severity: "breaking",
      path: "$.status",
      kind: "status-class-changed",
      detail: `mock returns ${mock.status}, upstream returned ${upstream.status}`,
    });
    return findings;
  }

  walk(mock.body, upstream.body, "$", new Set(opts.ignorePaths ?? []), opts.compareCosmetic ?? false, findings);
  return findings;
}
