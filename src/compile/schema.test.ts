import { describe, expect, it } from "vitest";
import { docsSchema, projectYamlSchema, ruleFileSchema, ruleSchema } from "./schema";

describe("projectYamlSchema", () => {
  it("accepts a minimal valid project", () => {
    expect(projectYamlSchema.parse({ name: "X", slug: "x" }).slug).toBe("x");
  });
  it("rejects a bad slug", () => {
    expect(() => projectYamlSchema.parse({ name: "X", slug: "Bad Slug" })).toThrow();
  });
  it("rejects an unknown top-level key", () => {
    expect(() => projectYamlSchema.parse({ name: "X", slug: "x", nope: 1 })).toThrow();
  });
  it("normalizes a trailing-slash basePath, and treats \"/\" as no basePath", () => {
    expect(projectYamlSchema.parse({ name: "X", slug: "x", basePath: "/api/" }).basePath).toBe("/api");
    expect(projectYamlSchema.parse({ name: "X", slug: "x", basePath: "/" }).basePath).toBeUndefined();
  });
});

describe("docsSchema (plan 18)", () => {
  it("defaults to disabled", () => {
    expect(docsSchema.parse({}).enabled).toBe(false);
  });
  it("accepts a description within the length cap and rejects past it", () => {
    expect(docsSchema.safeParse({ enabled: true, description: "hello" }).success).toBe(true);
    expect(docsSchema.safeParse({ enabled: true, description: "x".repeat(2001) }).success).toBe(false);
  });
  it("rejects an unknown key", () => {
    expect(docsSchema.safeParse({ enabled: true, logo: "x" }).success).toBe(false);
  });
});

describe("ruleFileSchema", () => {
  it("accepts a list of valid rules", () => {
    const rules = ruleFileSchema.parse([
      { id: "a", request: { method: "POST", path: "/x" }, response: { status: 200, body: { ok: true } } },
      { id: "b", request: { method: "*", path: "/y/:id", match: [{ jsonPath: "$.a", equals: "1" }] }, response: { status: 201 } },
    ]);
    expect(rules).toHaveLength(2);
  });
  it("rejects a path without a leading slash", () => {
    expect(() => ruleFileSchema.parse([{ id: "a", request: { method: "GET", path: "x" }, response: { status: 200 } }])).toThrow();
  });
  it("rejects a match item with two operators", () => {
    expect(() => ruleFileSchema.parse([{
      id: "a", request: { method: "GET", path: "/x", match: [{ jsonPath: "$.a", equals: "1", contains: "1" }] },
      response: { status: 200 },
    }])).toThrow();
  });
  it("rejects a match item with no target", () => {
    expect(() => ruleFileSchema.parse([{
      id: "a", request: { method: "GET", path: "/x", match: [{ equals: "1" }] }, response: { status: 200 },
    }])).toThrow();
  });
  it("rejects a path where ** is not the last segment", () => {
    expect(() => ruleFileSchema.parse([{
      id: "a", request: { method: "GET", path: "/x/**/y" }, response: { status: 200 },
    }])).toThrow(/\*\* must be the last path segment/);
    expect(() => ruleFileSchema.parse([{
      id: "a", request: { method: "GET", path: "/x/**" }, response: { status: 200 },
    }])).not.toThrow();
  });
  it("rejects a non-string regex operand", () => {
    expect(() => ruleFileSchema.parse([{
      id: "a", request: { method: "GET", path: "/x", match: [{ jsonPath: "$.a", regex: 5 }] },
      response: { status: 200 },
    }])).toThrow(/regex must be a string/);
  });

  it("rejects a jsonPath that traverses the prototype chain (B4)", () => {
    for (const jsonPath of ["$.__proto__.x", "$.a.constructor", "$.prototype"]) {
      const r = ruleSchema.safeParse({
        id: "r", request: { method: "GET", path: "/x", match: [{ jsonPath, exists: true }] },
        response: { status: 200 },
      });
      expect(r.success).toBe(false);
    }
  });

  it("rejects a regex with a nested unbounded quantifier (B7)", () => {
    const bad = ruleSchema.safeParse({
      id: "r", request: { method: "GET", path: "/x", match: [{ query: "q", regex: "(a+)+$" }] },
      response: { status: 200 },
    });
    expect(bad.success).toBe(false);

    const ok = ruleSchema.safeParse({
      id: "r", request: { method: "GET", path: "/x", match: [{ query: "q", regex: "^[a-z]+$" }] },
      response: { status: 200 },
    });
    expect(ok.success).toBe(true);
  });

  it("caps delayMs below the function budget (B11)", () => {
    expect(projectYamlSchema.safeParse({ name: "X", slug: "x", defaults: { delayMs: 5000 } }).success).toBe(true);
    expect(projectYamlSchema.safeParse({ name: "X", slug: "x", defaults: { delayMs: 9000 } }).success).toBe(false);
  });
});
