import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { useTraffic } from "./use-traffic";

let fetchSpy: ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.unstubAllGlobals();
});

// Regression: a project with zero traffic at page-load used to poll forever
// with `since` stuck at null, because the initial fetch's cursor fell back
// to null on an empty result and the poll treated null as "not ready yet".
// See EPOCH in use-traffic.ts. Real timers here (not fake): faking
// setInterval also breaks testing-library's own waitFor polling loop.
describe("useTraffic live poll on an initially-empty project", () => {
  it("picks up the first row once it appears, instead of polling forever", async () => {
    let call = 0;
    fetchSpy = vi.fn(async (url: string) => {
      call += 1;
      if (call === 1) return { ok: true, json: async () => ({ rows: [] }) };
      // The poll must have queried from the beginning of time (EPOCH), not
      // been skipped outright because cursorRef was null.
      expect(url).toContain("since=1970-01-01");
      return {
        ok: true,
        json: async () => ({
          rows: [{ id: "t1", method: "GET", path: "/hello", status: 200, durationMs: 3, at: "2026-01-01T00:00:01.000Z" }],
        }),
      };
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { result } = renderHook(() => useTraffic(["demo"], {}, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);

    await waitFor(() => expect(result.current.rows).toHaveLength(1), { timeout: 3000, interval: 100 });
    expect(result.current.rows[0]!.id).toBe("t1");
    expect(call).toBeGreaterThanOrEqual(2);
  }, 6000);
});
