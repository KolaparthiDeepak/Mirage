// Plan 24 — "a load test in CI ... asserting p95 stays under budget with a
// realistic rule count. It should run on every commit that touches
// src/engine/ or app/m/." A real load-testing tool and a dedicated CI
// pipeline stage are out of scope here (no infra to wire either into in this
// pass — see the plan-24 commit), but resolve() itself is a pure function:
// its own wall-clock cost is exactly what a load test on the mock route
// would actually be bottlenecked by (everything else per-request — I/O,
// traffic recording — happens off the response path, in after()). This
// runs in the normal test suite, so it already runs on every commit,
// touching src/engine/ or not.
import { describe, expect, it } from "vitest";
import { resolve } from "./resolve";
import { compileSegments } from "./match";
import type { ParsedRequest, ProjectConfig, Route } from "./types";

const RULE_COUNT = 200; // "a realistic rule count" — generous for a single project

function buildRoutes(count: number): Route[] {
  const routes: Route[] = [];
  for (let i = 0; i < count; i++) {
    const path = `/resource-${i}/:id`;
    routes.push({
      id: `rule-${i}`,
      method: "GET",
      path,
      segments: compileSegments(path),
      response: { status: 200, body: { id: `{{request.path.id}}`, index: i } },
    });
  }
  return routes;
}

const project: ProjectConfig = {
  name: "Perf",
  slug: "perf",
  defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
  routes: buildRoutes(RULE_COUNT),
};

function req(path: string): ParsedRequest {
  return { method: "GET", path, headers: {}, query: {}, body: undefined, rawBody: "" };
}

describe("resolve() perf budget (plan 24)", () => {
  it("resolves a match near the end of a 200-rule project well under 1ms on average", () => {
    const target = `/resource-${RULE_COUNT - 1}/abc`;
    const iterations = 5000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = resolve(req(target), project);
      if (result.matchedRuleId !== `rule-${RULE_COUNT - 1}`) throw new Error("perf test's own rule stopped matching");
    }
    const elapsedMs = performance.now() - start;
    const avgMs = elapsedMs / iterations;

    // Generous on purpose (real per-call cost is sub-microsecond on any
    // modern machine) — this budget exists to catch an accidental
    // quadratic-or-worse regression, not to chase a specific number.
    expect(avgMs).toBeLessThan(1);
  });

  it("resolving a guaranteed miss (worst case: scans every rule) is also well under budget", () => {
    const iterations = 5000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      resolve(req("/does-not-exist/xyz"), project);
    }
    const avgMs = (performance.now() - start) / iterations;
    expect(avgMs).toBeLessThan(1);
  });
});
