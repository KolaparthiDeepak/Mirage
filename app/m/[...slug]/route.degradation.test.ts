// Plan 24 — the degradation ladder's one previously-untested row: "traffic
// store down -> serve normally, drop the write, log it". Every other row
// (config store down, counter store down, upstream down, callback target
// down) already has its own direct test elsewhere; this file closes the gap
// the plan's own test list calls for: "each row ... has a test that forces
// the failure and asserts the behaviour."
import { describe, expect, it, vi } from "vitest";

const scheduled: Promise<unknown>[] = [];
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    scheduled.push(Promise.resolve(cb()));
  },
}));

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

// Mocks createStore() itself (one level below runtime-source.ts) rather than
// runtime-source.ts's own exports — that module's getCurrentConfig is real
// app logic this test doesn't want to reimplement or accidentally leave
// stale via a partial vi.mock factory; only the store construction it wraps
// needs to be fake here.
vi.mock("@/src/store/index", () => ({
  createStore: () => ({
    recordTraffic: async () => {
      throw new Error("disk full");
    },
  }),
}));

describe("mock route — degradation: traffic store down (plan 24)", () => {
  it("still returns the mock's normal response when the traffic write fails, and logs it", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://x/m/demo/ping"),
      { params: Promise.resolve({ slug: ["demo", "ping"] }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });

    await Promise.all(scheduled); // let the after()-scheduled write actually run
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("disk full"));

    errorSpy.mockRestore();
  });
});
