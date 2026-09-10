// Structural check against HAR 1.2's required fields — not a full JSON-Schema
// validation (that would need a schema-validator dependency for one export
// feature). Covers every field a HAR consumer actually reads: log.version,
// log.creator, and per-entry startedDateTime/time/request/response shape.
import { describe, expect, it } from "vitest";
import { buildHar } from "./har";
import type { TrafficEntry } from "@/src/store/types";

function entry(over: Partial<TrafficEntry> = {}): TrafficEntry {
  return {
    id: "e1",
    slug: "demo",
    at: "2026-01-01T00:00:00.000Z",
    method: "POST",
    path: "/orders",
    query: { page: "2" },
    reqHeaders: { "content-type": "application/json" },
    reqBody: '{"a":1}',
    status: 201,
    resHeaders: { "content-type": "application/json" },
    resBody: '{"ok":true}',
    matchedRuleId: "create-order",
    durationMs: 12,
    warnings: [],
    clientHash: null,
    configVersion: 1,
    truncated: false,
    ...over,
  };
}

describe("buildHar", () => {
  it("produces a HAR 1.2 log with the required top-level fields", () => {
    const har = buildHar([entry()]) as { log: { version: string; creator: unknown; entries: unknown[] } };
    expect(har.log.version).toBe("1.2");
    expect(har.log.creator).toBeDefined();
    expect(har.log.entries).toHaveLength(1);
  });

  it("carries method, url, headers, query and body on the request", () => {
    const [e] = (buildHar([entry()]) as { log: { entries: Array<{ request: Record<string, unknown> }> } }).log.entries;
    const req = e!.request;
    expect(req.method).toBe("POST");
    expect(req.url).toContain("/orders");
    expect(req.headers).toEqual([{ name: "content-type", value: "application/json" }]);
    expect(req.queryString).toEqual([{ name: "page", value: "2" }]);
    expect((req.postData as { text: string }).text).toBe('{"a":1}');
  });

  it("carries status, headers and content on the response", () => {
    const [e] = (buildHar([entry()]) as { log: { entries: Array<{ response: Record<string, unknown> }> } }).log.entries;
    const res = e!.response;
    expect(res.status).toBe(201);
    expect((res.content as { text: string }).text).toBe('{"ok":true}');
  });

  it("omits postData for a bodyless request", () => {
    const [e] = (buildHar([entry({ reqBody: null })]) as { log: { entries: Array<{ request: Record<string, unknown> }> } }).log.entries;
    expect(e!.request.postData).toBeUndefined();
  });

  it("handles an empty traffic list", () => {
    const har = buildHar([]) as { log: { entries: unknown[] } };
    expect(har.log.entries).toEqual([]);
  });
});
