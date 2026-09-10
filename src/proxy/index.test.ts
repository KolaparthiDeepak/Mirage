import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./ssrf", async (orig) => ({
  ...(await orig<typeof import("./ssrf")>()),
  assertSafeUpstreamUrl: vi.fn(),
}));
vi.mock("./forward", () => ({ forwardToUpstream: vi.fn() }));

import { assertSafeUpstreamUrl, UpstreamError } from "./ssrf";
import { forwardToUpstream } from "./forward";
import { proxyUnmatchedRequest } from "./index";
import { __resetRateLimit } from "./rate-limit";

const assertMock = assertSafeUpstreamUrl as unknown as ReturnType<typeof vi.fn>;
const forwardMock = forwardToUpstream as unknown as ReturnType<typeof vi.fn>;

const baseInput = {
  slug: "demo",
  method: "GET",
  subPath: "/things/9",
  search: "?q=1",
  reqHeaders: {},
  reqBody: null,
};
const record = { url: "https://api.example.com", mode: "record" as const, forwardAuth: false, timeoutMs: 5000 };

beforeEach(() => {
  __resetRateLimit();
  assertMock.mockReset().mockResolvedValue(new URL("https://api.example.com"));
  forwardMock.mockReset().mockResolvedValue({
    status: 200,
    headers: { "content-type": "application/json" },
    bodyText: '{"ok":true}',
    truncated: false,
  });
});

describe("proxyUnmatchedRequest", () => {
  it("builds the target URL from base + subPath + search and returns the upstream response", async () => {
    const out = await proxyUnmatchedRequest({ ...baseInput, upstream: record });
    expect("rateLimited" in out).toBe(false);
    const target = forwardMock.mock.calls[0]![0].targetUrl as URL;
    expect(target.href).toBe("https://api.example.com/things/9?q=1");
    if ("response" in out) {
      expect(out.response.status).toBe(200);
      expect(out.response.headers["x-mock-upstream"]).toBe("https://api.example.com");
      expect(out.record?.bodyText).toBe('{"ok":true}');
    }
  });

  it("records nothing in passthrough mode", async () => {
    const out = await proxyUnmatchedRequest({ ...baseInput, upstream: { ...record, mode: "passthrough" } });
    if ("response" in out) expect(out.record).toBeNull();
  });

  it("rate-limits after 60 calls in a window", async () => {
    for (let i = 0; i < 60; i++) {
      const out = await proxyUnmatchedRequest({ ...baseInput, upstream: record });
      expect("rateLimited" in out).toBe(false);
    }
    const blocked = await proxyUnmatchedRequest({ ...baseInput, upstream: record });
    expect(blocked).toEqual({ rateLimited: true });
    expect(forwardMock).toHaveBeenCalledTimes(60); // the 61st never reached the network
  });

  it("returns 502 and records nothing when the forward-time SSRF re-check fails", async () => {
    assertMock.mockRejectedValue(new UpstreamError("resolves to a private or reserved address"));
    const out = await proxyUnmatchedRequest({ ...baseInput, upstream: record });
    if ("response" in out) {
      expect(out.response.status).toBe(502);
      expect(out.record).toBeNull();
    }
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
