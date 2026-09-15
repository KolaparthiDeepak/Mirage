import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConfigCache, getConfig, invalidateConfig } from "./config-cache";
import type { Store, StoredProject } from "./types";

function stubProject(name: string): StoredProject {
  return {
    slug: "p",
    name,
    defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
    source: "store",
    configVersion: 1,
    updatedAt: new Date(0).toISOString(),
    rules: [{ ruleId: "r", position: 0, definition: { id: "r", request: { method: "GET", path: "/r" }, response: { status: 200 } } }],
  };
}

function fakeStore(getProject: Store["getProject"]): Store {
  return {
    getProject,
    listProjects: async () => [],
    saveProject: async () => {},
    deleteProject: async () => {},
    getConfigVersion: async () => null,
    recordTraffic: async () => {},
    queryTraffic: async () => [],
    pruneTraffic: async () => 0,
    bumpCounter: async () => 1,
    resetCounters: async () => 0,
    pruneCounters: async () => 0,
    listConfigEvents: async () => [],
    getConfigEvent: async () => null,
    pruneConfigEvents: async () => 0,
    saveFlow: async () => {},
    getFlow: async () => null,
    listFlows: async () => [],
    deleteFlow: async () => {},
    saveFlowRun: async () => {},
    getFlowRun: async () => null,
    listFlowRuns: async () => [],
    pruneFlowRuns: async () => 0,
    saveView: async () => {},
    getView: async () => null,
    listViews: async () => [],
    deleteView: async () => {},
    saveAlert: async () => {},
    getAlert: async () => null,
    listAlerts: async () => [],
    listAllEnabledAlerts: async () => [],
    deleteAlert: async () => {},
    updateAlertState: async () => {},
    countTraffic: async () => 0,
    close: async () => {},
  };
}

describe("config-cache", () => {
  beforeEach(() => {
    clearConfigCache();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("compiles and caches on the first read", async () => {
    const getProject = vi.fn(async () => stubProject("v1"));
    const store = fakeStore(getProject);
    const result = await getConfig(store, "p");
    expect(result?.config.name).toBe("v1");
    expect(result?.config.routes).toHaveLength(1);
    expect(result?.version).toBe(1);
    expect(getProject).toHaveBeenCalledTimes(1);
  });

  it("serves from cache within the TTL without re-querying", async () => {
    const getProject = vi.fn(async () => stubProject("v1"));
    const store = fakeStore(getProject);
    await getConfig(store, "p");
    await getConfig(store, "p");
    await getConfig(store, "p");
    expect(getProject).toHaveBeenCalledTimes(1);
  });

  it("re-queries after the TTL expires", async () => {
    const getProject = vi.fn(async () => stubProject("v1"));
    const store = fakeStore(getProject);
    await getConfig(store, "p");
    vi.advanceTimersByTime(6_000);
    await getConfig(store, "p");
    expect(getProject).toHaveBeenCalledTimes(2);
  });

  it("invalidateConfig forces the next read to re-query immediately", async () => {
    let name = "v1";
    const getProject = vi.fn(async () => stubProject(name));
    const store = fakeStore(getProject);
    await getConfig(store, "p");
    name = "v2";
    invalidateConfig("p");
    const result = await getConfig(store, "p");
    expect(result?.config.name).toBe("v2");
    expect(getProject).toHaveBeenCalledTimes(2);
  });

  it("returns null and does not cache an unknown project", async () => {
    const getProject = vi.fn(async () => null);
    const store = fakeStore(getProject);
    expect(await getConfig(store, "missing")).toBeNull();
    expect(await getConfig(store, "missing")).toBeNull();
    expect(getProject).toHaveBeenCalledTimes(2); // never cached, so never skipped
  });

  it("on a store read error, serves the last good config instead of throwing (plan 02 risk table)", async () => {
    const getProject = vi
      .fn<Store["getProject"]>()
      .mockResolvedValueOnce(stubProject("v1"))
      .mockRejectedValueOnce(new Error("connection refused"));
    const store = fakeStore(getProject);

    await getConfig(store, "p");
    vi.advanceTimersByTime(6_000); // force the TTL to expire so the next read hits the store
    const result = await getConfig(store, "p");
    expect(result?.config.name).toBe("v1"); // stale, but served — not thrown
  });

  it("propagates the error when there is no cached fallback at all", async () => {
    const getProject = vi.fn<Store["getProject"]>().mockRejectedValue(new Error("connection refused"));
    const store = fakeStore(getProject);
    await expect(getConfig(store, "p")).rejects.toThrow("connection refused");
  });
});
