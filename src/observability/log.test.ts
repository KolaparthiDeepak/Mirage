import { describe, expect, it, vi } from "vitest";
import { logMockEvent } from "./log";

describe("logMockEvent", () => {
  it("logs exactly the allow-listed fields — no body, no header value, ever", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logMockEvent({
      requestId: "req-1",
      project: "demo",
      method: "POST",
      path: "/orders",
      rule: "create-order",
      status: 201,
      matched: true,
      warnings: 2,
    });
    const line = JSON.parse(spy.mock.calls[0]![0] as string) as Record<string, unknown>;
    spy.mockRestore();
    expect(Object.keys(line).sort()).toEqual(["m", "matched", "path", "proj", "reqId", "rule", "status", "t", "warns"]);
    expect(line).toMatchObject({
      reqId: "req-1", proj: "demo", m: "POST", path: "/orders",
      rule: "create-order", status: 201, matched: true, warns: 2,
    });
  });

  it("includes upstream only when the caller sets it, and it's still not a header/body", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logMockEvent({
      requestId: "req-2", project: "demo", method: "GET", path: "/x",
      rule: null, status: 502, matched: false, warnings: 0, viaUpstream: true,
    });
    const line = JSON.parse(spy.mock.calls[0]![0] as string) as Record<string, unknown>;
    spy.mockRestore();
    expect(line.upstream).toBe(true);
    expect(Object.keys(line)).not.toContain("body");
    expect(Object.keys(line)).not.toContain("headers");
  });
});
