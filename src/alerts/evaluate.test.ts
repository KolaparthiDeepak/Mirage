import { describe, expect, it, vi } from "vitest";

const notifyAlertMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }) as { ok: boolean; error?: string });
vi.mock("./notify", () => ({ notifyAlert: (a: unknown, b: unknown, c: unknown) => notifyAlertMock(a, b, c) }));

import { evaluateAlert, sweepAlert } from "./evaluate";
import type { Store, StoredAlert, StoredView, TrafficFilter } from "../store/types";

function alert(overrides: Partial<StoredAlert> = {}): StoredAlert {
  return {
    id: "a1",
    slug: "p",
    name: "Unmatched spike",
    view: "unmatched",
    condition: { kind: "unmatched", gt: 5, windowMinutes: 10 },
    notify: { webhook: "https://hook.example.com/alert" },
    cooldownMinutes: 30,
    enabled: true,
    lastFiredAt: null,
    lastRecoveredAt: null,
    lastError: null,
    currentlyFiring: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

/** A minimal fake Store: only countTraffic/getView/updateAlertState do
 *  anything, everything else throws if called — a test that hits an
 *  unimplemented method is a test making an assumption evaluate.ts doesn't
 *  actually rely on. */
function fakeStore(opts: {
  countTraffic?: (filter: TrafficFilter) => number;
  view?: StoredView | null;
}): Store & { updateAlertState: ReturnType<typeof vi.fn> } {
  const updateAlertState = vi.fn(async () => {});
  const notImplemented = (name: string) => () => {
    throw new Error(`fakeStore.${name} should not be called by evaluate.ts`);
  };
  return {
    getProject: notImplemented("getProject"),
    listProjects: notImplemented("listProjects"),
    saveProject: notImplemented("saveProject"),
    deleteProject: notImplemented("deleteProject"),
    getConfigVersion: notImplemented("getConfigVersion"),
    listConfigEvents: notImplemented("listConfigEvents"),
    getConfigEvent: notImplemented("getConfigEvent"),
    pruneConfigEvents: notImplemented("pruneConfigEvents"),
    saveFlow: notImplemented("saveFlow"),
    getFlow: notImplemented("getFlow"),
    listFlows: notImplemented("listFlows"),
    deleteFlow: notImplemented("deleteFlow"),
    saveFlowRun: notImplemented("saveFlowRun"),
    getFlowRun: notImplemented("getFlowRun"),
    listFlowRuns: notImplemented("listFlowRuns"),
    pruneFlowRuns: notImplemented("pruneFlowRuns"),
    saveView: notImplemented("saveView"),
    getView: async (_slug: string, _id: string) => opts.view ?? null,
    listViews: notImplemented("listViews"),
    deleteView: notImplemented("deleteView"),
    saveAlert: notImplemented("saveAlert"),
    getAlert: notImplemented("getAlert"),
    listAlerts: notImplemented("listAlerts"),
    listAllEnabledAlerts: notImplemented("listAllEnabledAlerts"),
    deleteAlert: notImplemented("deleteAlert"),
    updateAlertState,
    recordTraffic: notImplemented("recordTraffic"),
    queryTraffic: notImplemented("queryTraffic"),
    countTraffic: async (filter: TrafficFilter) => opts.countTraffic?.(filter) ?? 0,
    pruneTraffic: notImplemented("pruneTraffic"),
    bumpCounter: notImplemented("bumpCounter"),
    resetCounters: notImplemented("resetCounters"),
    pruneCounters: notImplemented("pruneCounters"),
    close: async () => {},
  };
}

const NOW = new Date("2026-05-01T00:30:00.000Z");

describe("evaluateAlert", () => {
  it("unmatched: fires when the count exceeds the threshold", async () => {
    const store = fakeStore({ countTraffic: () => 6 });
    const result = await evaluateAlert(store, alert({ condition: { kind: "unmatched", gt: 5, windowMinutes: 10 } }), NOW);
    expect(result.firing).toBe(true);
  });

  it("unmatched: does not fire at or below the threshold", async () => {
    const store = fakeStore({ countTraffic: () => 5 });
    const result = await evaluateAlert(store, alert({ condition: { kind: "unmatched", gt: 5, windowMinutes: 10 } }), NOW);
    expect(result.firing).toBe(false);
  });

  it("silence: fires only when the count is exactly zero", async () => {
    const zero = fakeStore({ countTraffic: () => 0 });
    const one = fakeStore({ countTraffic: () => 1 });
    const cond = { kind: "silence" as const, windowMinutes: 15 };
    expect((await evaluateAlert(zero, alert({ condition: cond }), NOW)).firing).toBe(true);
    expect((await evaluateAlert(one, alert({ condition: cond }), NOW)).firing).toBe(false);
  });

  it("errorRate: computes errors/total ignoring the view's own status filter", async () => {
    // "errors" built-in view already scopes to 500-599 — evaluate.ts must
    // strip that scope, otherwise every errorRate condition would always
    // read back as 100%.
    const store = fakeStore({
      countTraffic: (filter) => (filter.statusFrom === 500 ? 3 : 12),
    });
    const result = await evaluateAlert(
      store,
      alert({ view: "errors", condition: { kind: "errorRate", gt: 0.2, windowMinutes: 10 } }),
      NOW,
    );
    expect(result.firing).toBe(true); // 3/12 = 25% > 20%
    expect(result.reason).toMatch(/3\/12/);
  });

  it("errorRate: zero total traffic never fires (no division by zero)", async () => {
    const store = fakeStore({ countTraffic: () => 0 });
    const result = await evaluateAlert(store, alert({ condition: { kind: "errorRate", gt: 0, windowMinutes: 10 } }), NOW);
    expect(result.firing).toBe(false);
  });

  it("resolves a custom saved view's query when the id isn't a built-in", async () => {
    const seen: TrafficFilter[] = [];
    const store = fakeStore({
      view: { id: "custom", slug: "p", name: "Custom", query: { pathContains: "/orders" }, createdAt: NOW.toISOString() },
      countTraffic: (filter) => {
        seen.push(filter);
        return 0;
      },
    });
    await evaluateAlert(store, alert({ view: "custom", condition: { kind: "silence", windowMinutes: 10 } }), NOW);
    expect(seen[0]).toMatchObject({ pathContains: "/orders", slug: "p" });
  });

  it("an unknown view never fires", async () => {
    const store = fakeStore({ view: null });
    const result = await evaluateAlert(store, alert({ view: "nope" }), NOW);
    expect(result.firing).toBe(false);
    expect(result.reason).toMatch(/not found/);
  });
});

describe("sweepAlert", () => {
  it("notifies and persists firing state on a fresh firing transition", async () => {
    notifyAlertMock.mockClear();
    notifyAlertMock.mockResolvedValueOnce({ ok: true });
    const store = fakeStore({ countTraffic: () => 10 });
    const outcome = await sweepAlert(store, alert({ currentlyFiring: false, lastFiredAt: null }), NOW);

    expect(outcome.firing).toBe(true);
    expect(outcome.notified).toBe(true);
    expect(notifyAlertMock).toHaveBeenCalledWith(expect.anything(), "firing", expect.any(String));
    expect(store.updateAlertState).toHaveBeenCalledWith(
      "p",
      "a1",
      expect.objectContaining({ currentlyFiring: true, lastFiredAt: NOW.toISOString() }),
    );
  });

  it("does not re-notify while still firing within the cooldown window", async () => {
    notifyAlertMock.mockClear();
    const store = fakeStore({ countTraffic: () => 10 });
    const fiveMinAgo = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    const outcome = await sweepAlert(
      store,
      alert({ currentlyFiring: true, lastFiredAt: fiveMinAgo, cooldownMinutes: 30 }),
      NOW,
    );

    expect(outcome.notified).toBe(false);
    expect(notifyAlertMock).not.toHaveBeenCalled();
    expect(store.updateAlertState).not.toHaveBeenCalled();
  });

  it("re-notifies once the cooldown has elapsed while still firing", async () => {
    notifyAlertMock.mockClear();
    notifyAlertMock.mockResolvedValueOnce({ ok: true });
    const store = fakeStore({ countTraffic: () => 10 });
    const fortyMinAgo = new Date(NOW.getTime() - 40 * 60_000).toISOString();
    const outcome = await sweepAlert(
      store,
      alert({ currentlyFiring: true, lastFiredAt: fortyMinAgo, cooldownMinutes: 30 }),
      NOW,
    );

    expect(outcome.notified).toBe(true);
    expect(notifyAlertMock).toHaveBeenCalledTimes(1);
  });

  it("sends exactly one recovery notification on the firing -> not-firing transition", async () => {
    notifyAlertMock.mockClear();
    notifyAlertMock.mockResolvedValueOnce({ ok: true });
    const store = fakeStore({ countTraffic: () => 0 });
    const outcome = await sweepAlert(store, alert({ currentlyFiring: true, lastFiredAt: NOW.toISOString() }), NOW);

    expect(outcome.firing).toBe(false);
    expect(outcome.notified).toBe(true);
    expect(notifyAlertMock).toHaveBeenCalledWith(expect.anything(), "recovered", expect.any(String));
    expect(store.updateAlertState).toHaveBeenCalledWith(
      "p",
      "a1",
      expect.objectContaining({ currentlyFiring: false, lastRecoveredAt: NOW.toISOString() }),
    );
  });

  it("does nothing on a quiet sweep that was already not firing", async () => {
    notifyAlertMock.mockClear();
    const store = fakeStore({ countTraffic: () => 0 });
    const outcome = await sweepAlert(store, alert({ currentlyFiring: false }), NOW);

    expect(outcome.notified).toBe(false);
    expect(notifyAlertMock).not.toHaveBeenCalled();
    expect(store.updateAlertState).not.toHaveBeenCalled();
  });

  it("records the notify failure as lastError without throwing", async () => {
    notifyAlertMock.mockClear();
    notifyAlertMock.mockResolvedValueOnce({ ok: false, error: "endpoint responded 500" });
    const store = fakeStore({ countTraffic: () => 10 });
    const outcome = await sweepAlert(store, alert({ currentlyFiring: false }), NOW);

    expect(outcome.notified).toBe(false);
    expect(outcome.error).toBe("endpoint responded 500");
    expect(store.updateAlertState).toHaveBeenCalledWith("p", "a1", expect.objectContaining({ lastError: "endpoint responded 500" }));
  });
});
