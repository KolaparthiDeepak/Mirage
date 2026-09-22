import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { __resetRateLimit } from "../proxy/rate-limit";
import { deliverCallback, renderCallbackString, renderCallbackValue } from "./deliver";
import type { CallbackContext } from "./deliver";

const ctx: CallbackContext = {
  request: { path: { id: "card-9" }, query: { debug: "1" }, body: { reason: "lost" } },
  response: { status: 202, body: { jobId: "job-abc", nested: { x: 5 } } },
};

type FetchImpl = (url: URL | string, opts: RequestInit & { headers: Headers }) => Promise<Response>;
function fakeFetch(status: number) {
  return vi.fn<FetchImpl>((async () => ({
    status,
    headers: new Headers(),
    body: new ReadableStream({ start: (c) => c.close() }),
  })) as unknown as FetchImpl);
}

beforeEach(() => __resetRateLimit());
afterEach(() => vi.unstubAllGlobals());

describe("renderCallback templating", () => {
  it("resolves request/response namespaces and keeps native types for a lone token", () => {
    const w: string[] = [];
    expect(renderCallbackString("job {{response.body.jobId}} card {{request.path.id}}", ctx, w)).toBe("job job-abc card card-9");
    expect(renderCallbackValue("{{response.body.nested.x}}", ctx, w)).toBe(5);
    expect(w).toEqual([]);
  });

  it("notes an unknown or unresolved token instead of dropping it", () => {
    const w: string[] = [];
    expect(renderCallbackString("{{response.body.missing}}", ctx, w)).toBe("{{response.body.missing}}");
    expect(w[0]).toMatch(/resolved to nothing/);
  });
});

describe("deliverCallback", () => {
  it("fires once with the correlated jobId in the body", async () => {
    const fetchMock = fakeFetch(200);
    vi.stubGlobal("fetch", fetchMock);
    const res = await deliverCallback("p", {
      url: "https://hook.example.com/cb",
      method: "POST",
      delayMs: 0,
      body: { jobId: "{{response.body.jobId}}", cardId: "{{request.path.id}}", status: "BLOCKED" },
    }, ctx);
    expect(res.delivered).toBe(true);
    expect(res.attempts).toHaveLength(1);
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(sentBody).toEqual({ jobId: "job-abc", cardId: "card-9", status: "BLOCKED" });
  });

  it("rejects a callback URL that resolves into a private range", async () => {
    const dns = await import("node:dns/promises");
    (dns.lookup as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ address: "10.0.0.9", family: 4 }]);
    const res = await deliverCallback("p", { url: "https://evil.example.com", method: "POST", delayMs: 0 }, ctx);
    expect(res.delivered).toBe(false);
    expect(res.attempts[0]!.error).toMatch(/private or reserved/);
  });

  it("retries exactly `attempts` times against a failing target, then reports not delivered", async () => {
    const fetchMock = fakeFetch(500);
    vi.stubGlobal("fetch", fetchMock);
    const res = await deliverCallback("p", {
      url: "https://hook.example.com/cb",
      method: "POST",
      delayMs: 0,
      retry: { attempts: 3, backoffMs: 0 },
    }, ctx);
    expect(res.delivered).toBe(false);
    expect(res.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
