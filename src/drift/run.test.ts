import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { __resetRateLimit } from "../proxy/rate-limit";
import { SqliteStore } from "../store/sqlite";
import type { StoredProject } from "../store/types";
import { runDriftCheck, SPEC_REPORT_ID } from "./run";

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    slug: "p",
    name: "P",
    defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { error: "nope" } } },
    source: "store",
    configVersion: 0,
    updatedAt: new Date(0).toISOString(),
    upstream: { url: "https://real-api.example.com", mode: "record", forwardAuth: false, timeoutMs: 5000 },
    drift: { enabled: true, allowUnsafeMethods: false, compareCosmetic: false, schedule: "manual" },
    rules: [
      {
        ruleId: "get-card",
        position: 0,
        definition: {
          id: "get-card",
          request: { method: "GET", path: "/cards/:id" },
          response: { status: 200, body: { id: "card-1", status: "ACTIVE" } },
        },
      },
    ],
    ...overrides,
  };
}

type FetchImpl = (url: URL | string, opts: RequestInit & { headers: Headers }) => Promise<Response>;
function fakeFetchOnce(bodyText: string, status = 200) {
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

let store: SqliteStore;

beforeEach(() => {
  __resetRateLimit();
  store = new SqliteStore(":memory:");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await store.close();
});

describe("runDriftCheck", () => {
  it("is a no-op when drift is not enabled", async () => {
    const summary = await runDriftCheck(store, project({ drift: { enabled: false, allowUnsafeMethods: false, compareCosmetic: false, schedule: "manual" } }));
    expect(summary).toEqual({ checked: 0, skipped: 0, findingsCount: 0, errored: 0 });
  });

  it("is a no-op when there is no active upstream", async () => {
    const summary = await runDriftCheck(store, project({ upstream: undefined }));
    expect(summary).toEqual({ checked: 0, skipped: 0, findingsCount: 0, errored: 0 });
  });

  it("clears an existing report when the rule now checks clean", async () => {
    await store.saveDriftReport({
      id: "get-card",
      slug: "p",
      ruleId: "get-card",
      findings: [{ severity: "breaking", path: "$.x", kind: "missing-field", detail: "stale" }],
      observedResponse: { status: 200, body: { x: 1 } },
      error: null,
      dismissed: false,
      firstSeenAt: new Date(0).toISOString(),
      lastCheckedAt: new Date(0).toISOString(),
    });
    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-9", status: "ACTIVE" })));

    const summary = await runDriftCheck(store, project());
    expect(summary).toEqual({ checked: 1, skipped: 0, findingsCount: 0, errored: 0 });
    expect(await store.getDriftReport("p", "get-card")).toBeNull();
  });

  it("saves a fresh, non-dismissed report the first time drift is found", async () => {
    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-9" }))); // status missing
    const summary = await runDriftCheck(store, project());
    expect(summary).toEqual({ checked: 1, skipped: 0, findingsCount: 1, errored: 0 });

    const report = await store.getDriftReport("p", "get-card");
    expect(report?.dismissed).toBe(false);
    expect(report?.findings).toHaveLength(1);
  });

  it("keeps a dismissal when the same drift reappears on the next check", async () => {
    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-9" })));
    await runDriftCheck(store, project());
    const first = await store.getDriftReport("p", "get-card");
    await store.saveDriftReport({ ...first!, dismissed: true });

    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-9" }))); // identical drift
    await runDriftCheck(store, project());
    const second = await store.getDriftReport("p", "get-card");
    expect(second?.dismissed).toBe(true);
    expect(second?.firstSeenAt).toBe(first?.firstSeenAt);
  });

  it("reopens a dismissed report when the drift's content actually changes", async () => {
    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-9" })));
    await runDriftCheck(store, project());
    const first = await store.getDriftReport("p", "get-card");
    await store.saveDriftReport({ ...first!, dismissed: true });

    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-9", status: 42 }))); // different drift now
    await runDriftCheck(store, project());
    const second = await store.getDriftReport("p", "get-card");
    expect(second?.dismissed).toBe(false);
  });

  it("does not create a report for a skipped (wildcard-method) rule", async () => {
    vi.stubGlobal("fetch", fakeFetchOnce("{}"));
    const summary = await runDriftCheck(
      store,
      project({
        rules: [{ ruleId: "any", position: 0, definition: { id: "any", request: { method: "*", path: "/x" }, response: { status: 200 } } }],
      }),
    );
    expect(summary).toEqual({ checked: 0, skipped: 1, findingsCount: 0, errored: 0 });
    expect(await store.getDriftReport("p", "any")).toBeNull();
  });

  it("records a probe failure as an error report, not as drift", async () => {
    vi.stubGlobal("fetch", fakeFetchOnce("<html>not json</html>"));
    const summary = await runDriftCheck(store, project());
    expect(summary).toEqual({ checked: 0, skipped: 0, findingsCount: 0, errored: 1 });

    const report = await store.getDriftReport("p", "get-card");
    expect(report?.error).toMatch(/not JSON/);
    expect(report?.findings).toEqual([]);
  });

  it("runs the spec diff under the reserved report id when specUrl is configured", async () => {
    const fetchMock = vi.fn<FetchImpl>((async (url: URL | string) => {
      const isSpec = String(url).endsWith("/openapi.json");
      return {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        body: new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode(
                isSpec ? JSON.stringify({ paths: { "/orders": { get: {} } } }) : JSON.stringify({ id: "card-9", status: "ACTIVE" }),
              ),
            );
            c.close();
          },
        }),
      };
    }) as unknown as FetchImpl);
    vi.stubGlobal("fetch", fetchMock);

    const summary = await runDriftCheck(
      store,
      project({ drift: { enabled: true, allowUnsafeMethods: false, compareCosmetic: false, schedule: "manual", specUrl: "/openapi.json" } }),
    );
    expect(summary.findingsCount).toBeGreaterThan(0);
    const specReport = await store.getDriftReport("p", SPEC_REPORT_ID);
    expect(specReport?.findings).toEqual([{ severity: "additive", path: "GET /orders", kind: "operation-added", detail: '"GET /orders" is new upstream' }]);
  });
});
