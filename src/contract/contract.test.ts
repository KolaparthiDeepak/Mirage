import { describe, it, expect, beforeEach } from "vitest";
import { normalizeSchema } from "../openapi/normalize";
import { compileSegments } from "../engine/match";
import type { Route } from "../engine/types";
import { validateAgainstSchema, __clearContractCache } from "./validate";
import { checkRuleAgainstSpec } from "./save-check";
import { checkRequestAgainstSpec } from "./request-check";
import { computeCoverage } from "./coverage";

beforeEach(() => __clearContractCache());

const doc = {
  openapi: "3.0.3",
  paths: {
    "/orders": {
      post: {
        requestBody: { content: { "application/json": { schema: { type: "object", required: ["sku"], properties: { sku: { type: "string" } } } } } },
        responses: { "201": { content: { "application/json": { schema: { type: "object", required: ["id", "riskScore"], properties: { id: { type: "string" }, riskScore: { type: "integer" }, note: { type: "string", nullable: true } } } } } } },
      },
    },
    "/orders/{id}": {
      get: {
        parameters: [{ name: "expand", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } } } } } } },
      },
      delete: { responses: { "204": {} } },
    },
  },
};

describe("normalizeSchema — 3.0 -> 3.1", () => {
  it("moves `nullable: true` into the type", () => {
    expect(normalizeSchema({ type: "string", nullable: true })).toEqual({ type: ["string", "null"] });
  });
  it("3.0 nullable and 3.1 [x,null] validate identically", async () => {
    const v1 = await validateAgainstSchema({ type: "string", nullable: true }, null);
    const v2 = await validateAgainstSchema({ type: ["string", "null"] }, null);
    expect(v1).toEqual([]);
    expect(v2).toEqual([]);
  });
});

describe("validateAgainstSchema", () => {
  it("names the path and the expectation on a type mismatch", async () => {
    const v = await validateAgainstSchema(
      { type: "object", properties: { riskScore: { type: "integer" } } },
      { riskScore: "high" },
    );
    expect(v).toEqual([{ path: "$.riskScore", message: "expected integer" }]);
  });
});

describe("checkRuleAgainstSpec (13.1)", () => {
  it("warns when a response body contradicts the schema", async () => {
    const w = await checkRuleAgainstSpec(doc, {
      id: "bad",
      request: { method: "POST", path: "/orders" },
      response: { status: 201, body: { id: "o1", riskScore: "high" } },
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/riskScore: expected integer/);
  });

  it("does not warn about a templated field", async () => {
    const w = await checkRuleAgainstSpec(doc, {
      id: "ok",
      request: { method: "POST", path: "/orders" },
      response: { status: 201, body: { id: "{{uuid}}", riskScore: 12 } },
    });
    expect(w).toEqual([]);
  });
});

describe("checkRequestAgainstSpec (13.2)", () => {
  it("flags a request body type mismatch", async () => {
    const v = await checkRequestAgainstSpec(doc, "POST", "/orders", 201, { sku: 5 }, {});
    expect(v[0]!.path).toBe("request.body.sku");
  });
  it("flags a missing required query parameter", async () => {
    const v = await checkRequestAgainstSpec(doc, "GET", "/orders/:id", 200, undefined, {});
    expect(v.some((x) => x.path === "request.query.expand")).toBe(true);
  });
  it("passes a valid request", async () => {
    expect(await checkRequestAgainstSpec(doc, "POST", "/orders", 201, { sku: "ABC" }, {})).toEqual([]);
  });
});

describe("computeCoverage (13.3)", () => {
  const route = (id: string, method: string, path: string, body: unknown): Route => ({
    id,
    method: method as Route["method"],
    path,
    segments: compileSegments(path),
    response: { status: 200, body },
  });

  it("counts unmocked, unexampled and unexercised", () => {
    const cov = computeCoverage(
      doc,
      [route("r1", "POST", "/orders", { id: "x" }), route("r2", "GET", "/orders/:id", null)],
      { r1: "2026-01-01T00:00:00.000Z" },
    );
    expect(cov.total).toBe(3); // POST /orders, GET /orders/:id, DELETE /orders/:id
    expect(cov.mocked).toBe(2);
    expect(cov.exampled).toBe(1); // only r1 has a body
    expect(cov.exercised).toBe(1); // only r1 has a last-called
    const del = cov.operations.find((o) => o.method === "DELETE")!;
    expect(del.ruleCount).toBe(0);
    expect(cov.percent).toBe(67);
  });
});
