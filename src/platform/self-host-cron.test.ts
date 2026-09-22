import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sweepAllAlertsMock = vi.fn(async () => [] as Array<{ firing: boolean }>);
const sweepAllDriftMock = vi.fn(async () => [] as Array<{ findingsCount: number }>);
vi.mock("../alerts/evaluate", () => ({ sweepAllAlerts: () => sweepAllAlertsMock() }));
vi.mock("../drift/run", () => ({ sweepAllDrift: () => sweepAllDriftMock() }));
vi.mock("../store/runtime-source", () => ({ getRuntimeStore: async () => ({}) }));

import { startSelfHostCron, __resetSelfHostCron } from "./self-host-cron";

beforeEach(() => {
  __resetSelfHostCron();
  sweepAllAlertsMock.mockClear();
  sweepAllDriftMock.mockClear();
});
afterEach(() => __resetSelfHostCron());

describe("startSelfHostCron", () => {
  it("logs on start and sweeps once per interval", async () => {
    const logs: string[] = [];
    const stop = startSelfHostCron({ intervalMs: 20, onLog: (l) => logs.push(l) });

    expect(logs[0]).toMatch(/started, sweeping every 20ms/);

    await new Promise((r) => setTimeout(r, 60));
    stop();

    expect(sweepAllAlertsMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(sweepAllDriftMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(logs.some((l) => l.includes("swept"))).toBe(true);
  });

  it("stop() actually stops further sweeps", async () => {
    const stop = startSelfHostCron({ intervalMs: 15, onLog: () => {} });
    await new Promise((r) => setTimeout(r, 20));
    stop();
    const callsAtStop = sweepAllAlertsMock.mock.calls.length;

    await new Promise((r) => setTimeout(r, 60));
    expect(sweepAllAlertsMock.mock.calls.length).toBe(callsAtStop);
  });

  it("starting twice is a no-op the second time, so sweeps never double up", async () => {
    const logs: string[] = [];
    const stop1 = startSelfHostCron({ intervalMs: 20, onLog: (l) => logs.push(l) });
    const stop2 = startSelfHostCron({ intervalMs: 20, onLog: (l) => logs.push(l) });

    expect(logs.filter((l) => l.includes("started")).length).toBe(1);
    stop1();
    stop2();
  });

  it("a sweep failure is logged, never thrown or crashing the interval", async () => {
    sweepAllAlertsMock.mockRejectedValueOnce(new Error("db down"));
    const logs: string[] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation((msg: string) => logs.push(msg));

    const stop = startSelfHostCron({ intervalMs: 15, onLog: () => {} });
    await new Promise((r) => setTimeout(r, 30));
    stop();

    expect(logs.some((l) => l.includes("db down"))).toBe(true);
    errorSpy.mockRestore();
  });
});
