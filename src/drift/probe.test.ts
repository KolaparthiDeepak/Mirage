import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { allowUpstreamCall, __resetRateLimit } from "../proxy/rate-limit";
import { probeRule } from "./probe";
import type { Route, UpstreamConfig, DriftConfig } from "../engine/types";

function route(overrides: Partial<Route> = {}): Route {
  return {
    id: "get-card",
    method: "GET",
    path: "/cards/:id",
    segments: [
      { kind: "literal", value: "cards" },
      { kind: "param", name: "id" },
    ],
    response: { status: 200, body: { id: "card-1", status: "ACTIVE" } },
    ...overrides,
  };
}

function upstream(overrides: Partial<UpstreamConfig> = {}): UpstreamConfig {
  return { url: "https://real-api.example.com", mode: "record", forwardAuth: false, timeoutMs: 5000, ...overrides };
}

function drift(overrides: Partial<DriftConfig> = {}): DriftConfig {
  return { enabled: true, allowUnsafeMethods: false, compareCosmetic: false, schedule: "manual", ...overrides };
}

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

describe("probeRule", () => {
  it("probes a safe GET route and finds no drift for an identical shape", async () => {
    const fetchMock = fakeFetch(200, JSON.stringify({ id: "card-999", status: "ACTIVE" }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await probeRule({ slug: "p", route: route(), upstream: upstream(), drift: drift() });
    expect(outcome).toMatchObject({ findings: [] });

    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://real-api.example.com/cards/1");
    expect((opts.headers as Headers).get("x-mirage-drift-check")).toBe("1");
  });

  it("resolves a path param to a concrete placeholder value", async () => {
    const fetchMock = fakeFetch(200, JSON.stringify({ id: "1", status: "ACTIVE" }));
    vi.stubGlobal("fetch", fetchMock);
    await probeRule({
      slug: "p",
      route: route({
        path: "/cards/:id/transactions/:txId",
        segments: [
          { kind: "literal", value: "cards" },
          { kind: "param", name: "id" },
          { kind: "literal", value: "transactions" },
          { kind: "param", name: "txId" },
        ],
      }),
      upstream: upstream(),
      drift: drift(),
    });
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://real-api.example.com/cards/1/transactions/1");
  });

  it("finds structural drift when a field is missing upstream", async () => {
    const fetchMock = fakeFetch(200, JSON.stringify({ id: "card-1" })); // status missing
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await probeRule({ slug: "p", route: route(), upstream: upstream(), drift: drift() });
    expect(outcome).toMatchObject({
      findings: [{ severity: "breaking", path: "$.status", kind: "missing-field", detail: '"status" is present in the mock but not upstream' }],
    });
  });

  it("refuses an unsafe method without a per-rule acknowledgement", async () => {
    const fetchMock = fakeFetch(200, "{}");
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await probeRule({ slug: "p", route: route({ method: "POST" }), upstream: upstream(), drift: drift({ allowUnsafeMethods: true }) });
    expect(outcome).toMatchObject({ skipped: expect.stringMatching(/not a safe method/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("probes an unsafe method once both the project and the rule opt in", async () => {
    const fetchMock = fakeFetch(200, JSON.stringify({ id: "card-1", status: "ACTIVE" }));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await probeRule({
      slug: "p",
      route: route({ method: "POST", drift: { ignorePaths: [], acknowledgeUnsafeMethod: true } }),
      upstream: upstream(),
      drift: drift({ allowUnsafeMethods: true }),
    });
    expect(outcome).toMatchObject({ findings: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never probes a wildcard-method rule", async () => {
    const outcome = await probeRule({ slug: "p", route: route({ method: "*" }), upstream: upstream(), drift: drift() });
    expect(outcome).toMatchObject({ skipped: expect.stringMatching(/wildcard/) });
  });

  it("reports SSRF rejection as could-not-check, not as drift", async () => {
    const dns = await import("node:dns/promises");
    (dns.lookup as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ address: "10.0.0.9", family: 4 }]);
    const outcome = await probeRule({ slug: "p", route: route(), upstream: upstream(), drift: drift() });
    expect(outcome).toMatchObject({ error: expect.stringMatching(/private or reserved/) });
  });

  it("reports a non-JSON upstream response as could-not-check, not as drift", async () => {
    const fetchMock = fakeFetch(200, "<html>not json</html>");
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await probeRule({ slug: "p", route: route(), upstream: upstream(), drift: drift() });
    expect(outcome).toMatchObject({ error: expect.stringMatching(/not JSON/) });
  });

  it("respects the per-project upstream rate limit", async () => {
    for (let i = 0; i < 60; i++) allowUpstreamCall("p");
    const fetchMock = fakeFetch(200, "{}");
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await probeRule({ slug: "p", route: route(), upstream: upstream(), drift: drift() });
    expect(outcome).toMatchObject({ error: expect.stringMatching(/rate limit/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies per-rule ignorePaths when comparing", async () => {
    const fetchMock = fakeFetch(200, JSON.stringify({ id: "card-1" })); // status missing, but ignored
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await probeRule({
      slug: "p",
      route: route({ drift: { ignorePaths: ["$.status"], acknowledgeUnsafeMethod: false } }),
      upstream: upstream(),
      drift: drift(),
    });
    expect(outcome).toMatchObject({ findings: [] });
  });
});
