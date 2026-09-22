import { describe, it, expect } from "vitest";
import type { ConfigEvent, StoredProject } from "./types";
import { revertEvent } from "./revert";

const rule = (id: string, status = 200) => ({ id, request: { method: "GET" as const, path: `/${id}` }, response: { status } });

function project(rules: StoredProject["rules"] = []): StoredProject {
  return {
    slug: "p",
    name: "P",
    defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: {} } },
    source: "store",
    configVersion: 1,
    updatedAt: new Date(0).toISOString(),
    rules,
  };
}

const ev = (over: Partial<ConfigEvent>): ConfigEvent => ({
  id: 1,
  slug: "p",
  at: new Date().toISOString(),
  actor: "t",
  kind: "rule.update",
  targetId: null,
  before: null,
  after: null,
  version: 1,
  ...over,
});

describe("revertEvent", () => {
  it("undoes a rule.create by deleting the rule", () => {
    const p = project([{ ruleId: "a", position: 0, definition: rule("a") }]);
    const r = revertEvent(p, ev({ kind: "rule.create", targetId: "a", after: rule("a") }));
    expect(r.conflict).toBeUndefined();
    expect(r.project.rules).toHaveLength(0);
  });

  it("recreates a deleted rule at its recorded position", () => {
    const p = project([{ ruleId: "b", position: 0, definition: rule("b") }]);
    const r = revertEvent(p, ev({ kind: "rule.delete", targetId: "a", before: { ...rule("a"), position: 3 } }));
    expect(r.project.rules.find((x) => x.ruleId === "a")?.position).toBe(3);
  });

  it("restores a rule.update to the prior definition", () => {
    const p = project([{ ruleId: "a", position: 0, definition: rule("a", 500) }]);
    const r = revertEvent(p, ev({ kind: "rule.update", targetId: "a", before: rule("a", 200), after: rule("a", 500) }));
    expect(r.project.rules[0]!.definition.response!.status).toBe(200);
  });

  it("flags a conflict when the target changed since, and honours force", () => {
    const p = project([{ ruleId: "a", position: 0, definition: rule("a", 418) }]);
    const stale = ev({ kind: "rule.update", targetId: "a", before: rule("a", 200), after: rule("a", 500) });
    expect(revertEvent(p, stale).conflict).toMatch(/changed since/);
    expect(revertEvent(p, stale, true).conflict).toBeUndefined();
  });

  it("undoes a reorder", () => {
    const p = project([
      { ruleId: "a", position: 0, definition: rule("a") },
      { ruleId: "b", position: 1, definition: rule("b") },
    ]);
    const r = revertEvent(p, ev({ kind: "rule.reorder", before: ["b", "a"], after: ["a", "b"] }));
    expect([...r.project.rules].sort((x, y) => x.position - y.position).map((x) => x.ruleId)).toEqual(["b", "a"]);
  });
});
