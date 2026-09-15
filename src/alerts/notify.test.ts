import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { __resetRateLimit } from "../proxy/rate-limit";
import { notifyAlert } from "./notify";
import type { StoredAlert } from "../store/types";

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

type FetchImpl = (url: URL | string, opts: RequestInit & { headers: Headers }) => Promise<Response>;
function fakeFetch(status: number) {
  return vi.fn<FetchImpl>((async () => ({
    status,
    headers: new Headers(),
    body: new ReadableStream({ start: (c) => c.close() }),
  })) as unknown as FetchImpl);
}

beforeEach(() => __resetRateLimit());
afterEach(() => vi.unstubAllGlobals());

describe("notifyAlert", () => {
  it("delivers a webhook payload describing the alert and event", async () => {
    const fetchMock = fakeFetch(200);
    vi.stubGlobal("fetch", fetchMock);
    const res = await notifyAlert(alert(), "firing", "3 unmatched requests");
    expect(res.ok).toBe(true);
    const sent = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(sent).toMatchObject({ alertId: "a1", slug: "p", event: "firing", reason: "3 unmatched requests" });
  });

  it("sends to every configured destination and fails overall if any one fails", async () => {
    const fetchMock = vi.fn<FetchImpl>((async (url: URL | string) => ({
      status: String(url).includes("slack") ? 500 : 200,
      headers: new Headers(),
      body: new ReadableStream({ start: (c) => c.close() }),
    })) as unknown as FetchImpl);
    vi.stubGlobal("fetch", fetchMock);

    const res = await notifyAlert(
      alert({ notify: { webhook: "https://hook.example.com/a", slack: "https://slack.example.com/b" } }),
      "firing",
      "reason",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/500/);
  });

  it("rejects a notification URL that resolves into a private range", async () => {
    const dns = await import("node:dns/promises");
    (dns.lookup as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    const res = await notifyAlert(alert({ notify: { webhook: "https://evil.example.com/hook" } }), "firing", "reason");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/private or reserved/);
  });

  it("fails when no destination is configured", async () => {
    const res = await notifyAlert(alert({ notify: {} }), "test", "reason");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no notification destination/);
  });
});
