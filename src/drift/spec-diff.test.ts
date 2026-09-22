import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { __resetRateLimit } from "../proxy/rate-limit";
import { compareSpecs, fetchUpstreamSpec } from "./spec-diff";

type FetchImpl = (url: URL | string, opts: RequestInit & { headers: Headers }) => Promise<Response>;
function fakeFetch(status: number, bodyText: string) {
  return vi.fn<FetchImpl>((async () => ({
    status,
    headers: new Headers({ "content-type": "application/json" }),
    body: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(bodyText));
        c.close();
      },
    }),
  })) as unknown as FetchImpl);
}

beforeEach(() => __resetRateLimit());
afterEach(() => vi.unstubAllGlobals());

describe("fetchUpstreamSpec", () => {
  it("resolves a relative specUrl against the upstream origin", async () => {
    const fetchMock = fakeFetch(200, JSON.stringify({ paths: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await fetchUpstreamSpec("https://real-api.example.com", "/openapi.json", 5000);
    expect(outcome).toEqual({ doc: { paths: {} } });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://real-api.example.com/openapi.json");
  });

  it("reports a non-2xx spec endpoint as could-not-check", async () => {
    const fetchMock = fakeFetch(404, "");
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await fetchUpstreamSpec("https://real-api.example.com", "/openapi.json", 5000);
    expect(outcome).toMatchObject({ error: expect.stringMatching(/404/) });
  });

  it("reports a non-JSON body as could-not-check", async () => {
    const fetchMock = fakeFetch(200, "<html></html>");
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await fetchUpstreamSpec("https://real-api.example.com", "/openapi.json", 5000);
    expect(outcome).toMatchObject({ error: expect.stringMatching(/not return JSON/) });
  });

  it("rejects a specUrl that resolves into a private range", async () => {
    const dns = await import("node:dns/promises");
    (dns.lookup as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ address: "10.0.0.9", family: 4 }]);
    const outcome = await fetchUpstreamSpec("https://real-api.example.com", "/openapi.json", 5000);
    expect(outcome).toMatchObject({ error: expect.stringMatching(/private or reserved/) });
  });
});

describe("compareSpecs", () => {
  const base = {
    paths: {
      "/orders": { get: { responses: { "200": { description: "ok" } } } },
      "/orders/{id}": { get: { responses: { "200": {} } } },
    },
  };

  it("finds no drift for an identical spec", () => {
    expect(compareSpecs(base, base)).toEqual([]);
  });

  it("reports a removed operation as breaking", () => {
    const upstream = { paths: { "/orders": base.paths["/orders"] } };
    const findings = compareSpecs(base, upstream);
    expect(findings).toEqual([
      { severity: "breaking", path: "GET /orders/{id}", kind: "operation-removed", detail: '"GET /orders/{id}" is no longer in the upstream spec' },
    ]);
  });

  it("reports an added operation as additive", () => {
    const upstream = { paths: { ...base.paths, "/orders/{id}/cancel": { post: { responses: { "200": {} } } } } };
    const findings = compareSpecs(base, upstream);
    expect(findings).toEqual([
      { severity: "additive", path: "POST /orders/{id}/cancel", kind: "operation-added", detail: '"POST /orders/{id}/cancel" is new upstream' },
    ]);
  });

  it("reports a changed operation body as breaking, ignoring the operation's own summary/description", () => {
    const reworded = {
      paths: {
        ...base.paths,
        "/orders": { get: { summary: "List orders", responses: base.paths["/orders"].get.responses } },
      },
    };
    expect(compareSpecs(base, reworded)).toEqual([]);

    const changed = {
      paths: {
        ...base.paths,
        "/orders": { get: { responses: { "200": {} }, parameters: [{ name: "limit" }] } },
      },
    };
    const findings = compareSpecs(base, changed);
    expect(findings).toEqual([
      { severity: "breaking", path: "GET /orders", kind: "operation-changed", detail: '"GET /orders"\'s request/response shape changed upstream' },
    ]);
  });
});
