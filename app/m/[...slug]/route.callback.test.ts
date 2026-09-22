// Plan 12 — callbacks wired into the real mock route.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SqliteStore } from "@/src/store/sqlite";
import type { StoredProject } from "@/src/store/types";

const scheduled: Promise<unknown>[] = [];
vi.mock("next/server", () => ({ after: (cb: () => unknown) => void scheduled.push(Promise.resolve(cb())) }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

type FetchImpl = (url: URL | string, opts?: RequestInit) => Promise<Response>;
const fetchMock = vi.fn<FetchImpl>((async () => ({
  status: 200,
  headers: new Headers(),
  body: new ReadableStream({ start: (c) => c.close() }),
})) as unknown as FetchImpl);

describe("mock route — callbacks (plan 12)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-route-cb-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    process.env.MIRAGE_RECORD_TRAFFIC = "on";
    vi.stubGlobal("fetch", fetchMock);

    const s = new SqliteStore(process.env.MIRAGE_DB_PATH);
    const project: StoredProject = {
      slug: "cb",
      name: "Callbacks",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: {} } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [
        {
          ruleId: "block", position: 0,
          definition: {
            id: "block",
            request: { method: "POST", path: "/cards/:id/block" },
            response: { status: 202, body: { jobId: "job-1" } },
            callback: {
              url: "https://hook.example.com/cb",
              method: "POST",
              delayMs: 0,
              body: { jobId: "{{response.body.jobId}}", cardId: "{{request.path.id}}", status: "BLOCKED" },
            },
          },
        },
        { ruleId: "plain", position: 1, definition: { id: "plain", request: { method: "GET", path: "/ping" }, response: { status: 200 } } },
      ],
    };
    await s.saveProject(project);
    await s.close();
  });

  afterAll(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    delete process.env.MIRAGE_RECORD_TRAFFIC;
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  it("fires a correlated callback after a 202 and records an outbound traffic row", async () => {
    scheduled.length = 0;
    fetchMock.mockClear();
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x/m/cb/cards/card-9/block", { method: "POST" }), {
      params: Promise.resolve({ slug: ["cb", "cards", "card-9", "block"] }),
    });
    expect(res.status).toBe(202);

    await Promise.all(scheduled);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body).toEqual({ jobId: "job-1", cardId: "card-9", status: "BLOCKED" });

    const store = await (await import("@/src/store/runtime-source")).getRuntimeStore();
    const rows = await store.queryTraffic({ slug: "cb" });
    expect(rows.some((r) => r.direction === "outbound" && r.status === 200)).toBe(true);
  });

  it("a rule without a callback issues no outbound work", async () => {
    scheduled.length = 0;
    fetchMock.mockClear();
    const { GET } = await import("./route");
    await GET(new Request("https://x/m/cb/ping"), { params: Promise.resolve({ slug: ["cb", "ping"] }) });
    await Promise.all(scheduled);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
