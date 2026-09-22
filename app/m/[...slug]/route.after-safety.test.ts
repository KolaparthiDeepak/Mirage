// Regression test for a real defect caught by manual smoke-testing, not by
// the mocked unit tests: Next's after() throws *synchronously*, outside any
// callback, when called without a real request-scope context — and it is
// called before the response is built. A bare try/catch around the traffic
// write's *contents* does not protect against that; the call to after()
// itself must be inside the guard too, or a traffic-recording problem can
// turn a 200 into an unhandled exception, which is exactly what plan 04
// promises never happens.
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  after: () => {
    throw new Error("after was called outside a request scope");
  },
}));

vi.mock("@/mocks.generated.json", () => ({
  default: {
    builtAt: "t", commit: "c", warnings: [],
    projects: {
      demo: {
        name: "Demo", slug: "demo", basePath: "/commands",
        defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
        routes: [{
          id: "ok", method: "POST", path: "/verify",
          segments: [{ kind: "literal", value: "verify" }],
          response: { status: 200, body: { verified: true } },
        }],
      },
    },
  },
}));

describe("mock route — after() failure never reaches the response", () => {
  it("still returns the mock's normal response when after() throws synchronously", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x/m/demo/commands/verify", { method: "POST", body: "{}" }),
      { params: Promise.resolve({ slug: ["demo", "commands", "verify"] }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
  });
});
