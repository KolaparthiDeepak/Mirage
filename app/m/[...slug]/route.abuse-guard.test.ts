// Plan 24 — abuse controls on the mock route: a per-IP limit, low enough to
// actually verify in a test (the real default is 600/min — generous on
// purpose, so no realistic caller trips it by accident).
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: () => {} }));

vi.mock("@/mocks.generated.json", () => ({
  default: {
    builtAt: "t", commit: "c", warnings: [],
    projects: {
      demo: {
        name: "Demo", slug: "demo",
        defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
        routes: [{
          id: "ok", method: "GET", path: "/ping",
          segments: [{ kind: "literal", value: "ping" }],
          response: { status: 200, body: { pong: true } },
        }],
      },
    },
  },
}));

vi.mock("@/src/observability/abuse-guard", () => ({
  allowMockRequest: (key: string) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts.get(key)! <= 3;
  },
}));

const counts = new Map<string, number>();

function callWithIp(ip: string) {
  return import("./route").then(({ GET }) =>
    GET(new Request("https://x/m/demo/ping", { headers: { "x-forwarded-for": ip } }), {
      params: Promise.resolve({ slug: ["demo", "ping"] }),
    }),
  );
}

describe("mock route — abuse guard (plan 24)", () => {
  it("429s a client once it's over the limit, and other clients are unaffected", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await callWithIp("203.0.113.9")).status).toBe(200);
    }
    const over = await callWithIp("203.0.113.9");
    expect(over.status).toBe(429);

    // A different client (different IP -> different clientHash) is untouched.
    expect((await callWithIp("203.0.113.10")).status).toBe(200);
  });

  it("skips rate limiting entirely when there is no client IP to key on", async () => {
    const { GET } = await import("./route");
    for (let i = 0; i < 10; i++) {
      const res = await GET(new Request("https://x/m/demo/ping"), { params: Promise.resolve({ slug: ["demo", "ping"] }) });
      expect(res.status).toBe(200);
    }
  });
});
