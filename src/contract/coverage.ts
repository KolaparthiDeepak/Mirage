// Plan 13.3 — coverage: which operations are mocked, exampled and exercised.
import type { Route } from "../engine/types";
import { listOperations } from "./operation";

function opKey(method: string, path: string): string {
  return `${method} ${path}`;
}

/** "/users/:id" and "/users/{id}" compare equal here (params normalised). */
function normPath(p: string): string {
  return p
    .replace(/\{([^}]+)\}/g, ":$1")
    .split("/")
    .map((s) => (s.startsWith(":") ? ":p" : s))
    .join("/");
}

export interface OperationCoverage {
  method: string;
  path: string;
  ruleCount: number;
  /** at least one matching rule has a non-empty response body */
  hasExample: boolean;
  lastCalledAt: string | null;
}

export interface Coverage {
  operations: OperationCoverage[];
  total: number;
  mocked: number;
  exampled: number;
  exercised: number;
  /** mocked / total, 0 when there are no operations. */
  percent: number;
}

export function computeCoverage(
  openApiDoc: unknown,
  routes: Route[],
  lastCalledByRuleId: Record<string, string>,
): Coverage {
  const ops = listOperations(openApiDoc);

  const rulesByOp = new Map<string, Route[]>();
  for (const r of routes) {
    const k = opKey(r.method, normPath(r.path));
    const list = rulesByOp.get(k) ?? [];
    list.push(r);
    rulesByOp.set(k, list);
  }

  const operations: OperationCoverage[] = ops.map((op) => {
    const matched = rulesByOp.get(opKey(op.method, normPath(op.path))) ?? [];
    const lastCalled = matched
      .map((r) => lastCalledByRuleId[r.id])
      .filter((x): x is string => !!x)
      .sort()
      .pop();
    return {
      method: op.method,
      path: op.path,
      ruleCount: matched.length,
      hasExample: matched.some((r) => r.response.body != null && r.response.body !== ""),
      lastCalledAt: lastCalled ?? null,
    };
  });

  const total = operations.length;
  const mocked = operations.filter((o) => o.ruleCount > 0).length;
  const exampled = operations.filter((o) => o.hasExample).length;
  const exercised = operations.filter((o) => o.lastCalledAt != null).length;

  return {
    operations,
    total,
    mocked,
    exampled,
    exercised,
    percent: total === 0 ? 0 : Math.round((mocked / total) * 100),
  };
}
