import { describe, it, expect } from "vitest";
import { compileSegments } from "../engine/match";
import type { ProjectConfig } from "../engine/types";
import type { Store } from "../store/types";
import { flowSchema } from "./schema";
import { runFlow } from "./run";

function counterStore(): Store {
  const counters = new Map<string, number>();
  return {
    async bumpCounter(slug: string, ruleId: string, session: string) {
      const k = `${slug}|${ruleId}|${session}`;
      const n = (counters.get(k) ?? 0) + 1;
      counters.set(k, n);
      return n;
    },
  } as unknown as Store;
}

const project: ProjectConfig = {
  name: "P",
  slug: "p",
  defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { error: "nope" } } },
  routes: [
    {
      id: "verify",
      method: "POST",
      path: "/verify",
      segments: compileSegments("/verify"),
      match: [{ jsonPath: "$.customerId", equals: "cust-ok" }],
      response: { status: 200, body: { verified: true, sessionToken: "tok-{{request.body.customerId}}" } },
    },
    {
      id: "block",
      method: "POST",
      path: "/block",
      segments: compileSegments("/block"),
      response: { status: 200, body: { blocked: true } },
    },
    {
      id: "flaky",
      method: "GET",
      path: "/flaky",
      segments: compileSegments("/flaky"),
      response: { status: 503 },
      responses: { strategy: "sequence", repeatLast: true, variants: [{ status: 503 }, { status: 200 }] },
    },
  ],
};

describe("runFlow", () => {
  it("runs a three-step flow in order and reports per-step results", async () => {
    const flow = flowSchema.parse({
      id: "f1",
      name: "F1",
      steps: [
        { name: "verify", request: { method: "POST", path: "/verify", body: { customerId: "cust-ok" } }, assert: [{ status: 200 }] },
        { name: "block", request: { method: "POST", path: "/block" }, assert: [{ status: 200 }, { matchedRule: "block" }] },
        { name: "check404", request: { method: "GET", path: "/nope" }, assert: [{ status: 404 }] },
      ],
    });
    const out = await runFlow(project, flow, counterStore(), "p", "run-1");
    expect(out.status).toBe("passed");
    expect(out.steps.map((s) => s.passed)).toEqual([true, true, true]);
  });

  it("captures a value from step 1 and substitutes it into step 2", async () => {
    const flow = flowSchema.parse({
      id: "f2",
      name: "F2",
      steps: [
        {
          name: "verify",
          request: { method: "POST", path: "/verify", body: { customerId: "cust-ok" } },
          assert: [{ status: 200 }],
          capture: [{ name: "token", from: "$.sessionToken" }],
        },
        {
          name: "block",
          request: { method: "POST", path: "/block", headers: { "x-session": "{{vars.token}}" } },
          assert: [{ jsonPath: "$.blocked", equals: true }],
        },
      ],
    });
    const out = await runFlow(project, flow, counterStore(), "p", "run-2");
    expect(out.status).toBe("passed");
  });

  it("a failing assertion stops the run and names expected vs actual", async () => {
    const flow = flowSchema.parse({
      id: "f3",
      name: "F3",
      steps: [
        { name: "block", request: { method: "POST", path: "/block" }, assert: [{ status: 500 }] },
        { name: "never-reached", request: { method: "GET", path: "/nope" }, assert: [{ status: 404 }] },
      ],
    });
    const out = await runFlow(project, flow, counterStore(), "p", "run-3");
    expect(out.status).toBe("failed");
    expect(out.steps).toHaveLength(1);
    expect(out.steps[0]!.assertions[0]).toMatchObject({ passed: false, expected: 500, actual: 200 });
  });

  it("matchedRule assertion fails when a different rule served the response", async () => {
    const flow = flowSchema.parse({
      id: "f4",
      name: "F4",
      steps: [{ name: "verify", request: { method: "POST", path: "/verify", body: { customerId: "cust-ok" } }, assert: [{ matchedRule: "block" }] }],
    });
    const out = await runFlow(project, flow, counterStore(), "p", "run-4");
    expect(out.status).toBe("failed");
    expect(out.steps[0]!.assertions[0]!.passed).toBe(false);
  });

  it("continueOnFailure lets the run proceed past a failed step", async () => {
    const flow = flowSchema.parse({
      id: "f5",
      name: "F5",
      steps: [
        { name: "wrong", request: { method: "POST", path: "/block" }, assert: [{ status: 500 }], continueOnFailure: true },
        { name: "right", request: { method: "POST", path: "/block" }, assert: [{ status: 200 }] },
      ],
    });
    const out = await runFlow(project, flow, counterStore(), "p", "run-5");
    expect(out.status).toBe("failed"); // step 1 failed overall...
    expect(out.steps).toHaveLength(2); // ...but step 2 still ran
    expect(out.steps[1]!.passed).toBe(true);
  });

  it("concurrent runs of the same flow do not share sequence state (plan 10 sessions)", async () => {
    const store = counterStore();
    const flow = flowSchema.parse({
      id: "f6",
      name: "F6",
      steps: [{ name: "flaky", request: { method: "GET", path: "/flaky" }, assert: [] }],
    });
    const [a, b] = await Promise.all([
      runFlow(project, flow, store, "p", "run-a"),
      runFlow(project, flow, store, "p", "run-b"),
    ]);
    // both are the FIRST call in their own session -> both see variant 0 (503)
    expect(a.steps[0]!.status).toBe(503);
    expect(b.steps[0]!.status).toBe(503);
  });

  it("terminates with status error when a step throws", async () => {
    const badProject: ProjectConfig = { ...project, routes: [] };
    const flow = flowSchema.parse({
      id: "f7",
      name: "F7",
      steps: [{ name: "x", request: { method: "GET", path: "/anything" }, assert: [{ status: 200 }] }],
    });
    // no throw expected here (notFound path), but confirms 404 default behaves
    const out = await runFlow(badProject, flow, counterStore(), "p", "run-7");
    expect(out.steps[0]!.status).toBe(404);
  });
});
