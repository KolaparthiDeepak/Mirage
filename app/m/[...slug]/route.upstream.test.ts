// Plan 07 — the proxy fallback wired into the real mock route.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SqliteStore } from "@/src/store/sqlite";
import type { StoredProject } from "@/src/store/types";

const scheduled: Promise<unknown>[] = [];
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => void scheduled.push(Promise.resolve(cb())),
}));
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

type FetchImpl = (url: URL | string, opts?: RequestInit) => Promise<Response>;
const fetchMock = vi.fn<FetchImpl>((async () => ({
  status: 201,
  headers: new Headers({ "content-type": "application/json" }),
  body: new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('{"from":"upstream"}'));
      c.close();
    },
  }),
})) as unknown as FetchImpl);

describe("mock route — upstream proxy (plan 07)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-route-upstream-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    vi.stubGlobal("fetch", fetchMock);

    const seed = new SqliteStore(process.env.MIRAGE_DB_PATH);
    const project: StoredProject = {
      slug: "up",
      name: "Upstream Demo",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
      source: "store",
      upstream: { url: "https://api.example.com", mode: "record", forwardAuth: false, timeoutMs: 5000 },
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [
        { ruleId: "known", position: 0, definition: { id: "known", request: { method: "GET", path: "/known" }, response: { status: 200, body: { from: "mock" } } } },
      ],
    };
    await seed.saveProject(project);
    await seed.close();
  });

  afterEach(() => {
    fetchMock.mockClear();
    scheduled.length = 0;
    delete process.env.MIRAGE_UPSTREAM;
  });

  afterAll(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  it("serves a matched request from the mock — upstream is never called", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/m/up/known"), {
      params: Promise.resolve({ slug: ["up", "known"] }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ from: "mock" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards an unmatched request to the upstream and records it with viaUpstream", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/m/up/unknown/42?q=1"), {
      params: Promise.resolve({ slug: ["up", "unknown", "42"] }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ from: "upstream" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]![0] as URL).href).toBe("https://api.example.com/unknown/42?q=1");
    expect(res.headers.get("x-mock-matched")).toBe("false");

    await Promise.all(scheduled);
    const store = await (await import("@/src/store/runtime-source")).getRuntimeStore();
    const rows = await store.queryTraffic({ slug: "up", viaUpstreamOnly: true });
    expect(rows.some((r) => r.path === "/unknown/42" && r.status === 201 && r.viaUpstream)).toBe(true);
  });

  it("MIRAGE_UPSTREAM=off restores plain notFound behaviour", async () => {
    process.env.MIRAGE_UPSTREAM = "off";
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/m/up/still-unknown"), {
      params: Promise.resolve({ slug: ["up", "still-unknown"] }),
    });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
