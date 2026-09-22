import { describe, expect, it } from "vitest";
import { serveMock } from "./serve";
import type { ProjectConfig } from "../../../src/engine/types";

function project(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "P",
    slug: "p",
    defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
    routes: [
      {
        id: "hello",
        method: "GET",
        path: "/hello",
        segments: [{ kind: "literal", value: "hello" }],
        response: { status: 200, body: { hi: true } },
      },
    ],
    ...overrides,
  };
}

describe("serveMock", () => {
  it("resolves a matching rule and stamps the match headers", async () => {
    const req = new Request("http://localhost/m/p/hello");
    const outcome = await serveMock(project(), req, "/hello");
    expect(outcome.matchedRuleId).toBe("hello");
    expect(outcome.response.status).toBe(200);
    expect(outcome.response.headers.get("x-mock-matched")).toBe("true");
    expect(outcome.response.headers.get("x-mock-rule-id")).toBe("hello");
    expect(await outcome.response.json()).toEqual({ hi: true });
  });

  it("falls back to the project's notFound default for an unmatched path", async () => {
    const req = new Request("http://localhost/m/p/nope");
    const outcome = await serveMock(project(), req, "/nope");
    expect(outcome.matchedRuleId).toBeNull();
    expect(outcome.response.status).toBe(404);
    expect(outcome.response.headers.get("x-mock-matched")).toBe("false");
  });

  it("serves the OpenAPI doc at /__spec when present, 404s when absent", async () => {
    const withDoc = await serveMock(project({ openApiDoc: { openapi: "3.0.0" } }), new Request("http://localhost/m/p/__spec"), "/__spec");
    expect(withDoc.response.status).toBe(200);
    expect(await withDoc.response.json()).toEqual({ openapi: "3.0.0" });

    const withoutDoc = await serveMock(project(), new Request("http://localhost/m/p/__spec"), "/__spec");
    expect(withoutDoc.response.status).toBe(404);
  });

  it("answers CORS preflight only when the project enables cors", async () => {
    const on = await serveMock(project({ defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: null } } }), new Request("http://localhost/m/p/hello", { method: "OPTIONS" }), "/hello");
    expect(on.response.status).toBe(204);
    expect(on.response.headers.get("access-control-allow-origin")).toBe("*");

    const off = await serveMock(project(), new Request("http://localhost/m/p/hello", { method: "OPTIONS" }), "/hello");
    expect(off.response.status).toBe(404); // OPTIONS with cors off just falls through to normal resolution
  });

  it("honours a rule's configured delay", async () => {
    const withDelay = project({
      defaults: { delayMs: 20, cors: false, notFound: { status: 404, body: null } },
    });
    const start = Date.now();
    await serveMock(withDelay, new Request("http://localhost/m/p/hello"), "/hello");
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});
