// Plan 05: the four traffic API routes, against a real seeded SQLite store —
// same pattern as app/m/[...slug]/route.store-source.test.ts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SqliteStore } from "@/src/store/sqlite";
import type { StoredProject, TrafficEntry } from "@/src/store/types";

function entry(over: Partial<TrafficEntry> = {}): TrafficEntry {
  return {
    id: crypto.randomUUID(),
    slug: "demo",
    at: new Date().toISOString(),
    method: "GET",
    path: "/x",
    query: {},
    reqHeaders: {},
    reqBody: null,
    status: 200,
    resHeaders: {},
    resBody: null,
    matchedRuleId: "r",
    durationMs: 5,
    warnings: [],
    clientHash: null,
    configVersion: 1,
    truncated: false,
    viaUpstream: false,
    ...over,
  };
}

describe("traffic API routes (plan 05)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-traffic-api-"));
    const dbPath = join(dir, "mirage.db");
    process.env.MIRAGE_DB_PATH = dbPath;
    process.env.MIRAGE_CONFIG_SOURCE = "store";

    store = new SqliteStore(dbPath);
    const project: StoredProject = {
      slug: "demo",
      name: "Demo",
      defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [
        {
          ruleId: "get-widget",
          position: 0,
          definition: { id: "get-widget", request: { method: "GET", path: "/widgets/:id" }, response: { status: 200, body: { ok: true } } },
        },
      ],
    };
    await store.saveProject(project);

    await store.recordTraffic(entry({ method: "GET", path: "/widgets/1", status: 200, matchedRuleId: "get-widget", at: "2026-06-01T00:00:00.000Z" }));
    await store.recordTraffic(entry({ method: "GET", path: "/widgets/2", status: 500, matchedRuleId: "get-widget", at: "2026-06-01T00:00:01.000Z" }));
    await store.recordTraffic(entry({ method: "POST", path: "/nope", status: 404, matchedRuleId: null, at: "2026-06-01T00:00:02.000Z" }));
  });

  afterAll(async () => {
    await store.close();
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  });

  const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it("GET traffic lists rows newest first", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/api/projects/demo/traffic"), ctx("demo"));
    const body = await res.json();
    expect(body.rows).toHaveLength(3);
    expect(body.rows[0].path).toBe("/nope");
  });

  it("GET traffic filters by status class", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/api/projects/demo/traffic?status=5xx"), ctx("demo"));
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].status).toBe(500);
  });

  it("GET traffic filters to unmatched only", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/api/projects/demo/traffic?matched=false"), ctx("demo"));
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].path).toBe("/nope");
  });

  it("GET traffic/:id returns one row", async () => {
    const [row] = await store.queryTraffic({ slug: "demo", pathContains: "widgets/1" });
    const { GET } = await import("./[id]/route");
    const res = await GET(new Request("https://x"), { params: Promise.resolve({ slug: "demo", id: row!.id }) });
    expect((await res.json()).path).toBe("/widgets/1");
  });

  it("GET traffic/:id returns 404 for an unknown id", async () => {
    const { GET } = await import("./[id]/route");
    const res = await GET(new Request("https://x"), { params: Promise.resolve({ slug: "demo", id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("GET traffic/:id/trace explains the winning rule", async () => {
    const [row] = await store.queryTraffic({ slug: "demo", pathContains: "widgets/1" });
    const { GET } = await import("./[id]/trace/route");
    const res = await GET(new Request("https://x"), { params: Promise.resolve({ slug: "demo", id: row!.id }) });
    const body = await res.json();
    expect(body.winnerRuleId).toBe("get-widget");
    expect(body.staleConfig).toBe(false);
  });

  it("GET traffic/:id/trace explains an unmatched request", async () => {
    const [row] = await store.queryTraffic({ slug: "demo", pathContains: "nope" });
    const { GET } = await import("./[id]/trace/route");
    const res = await GET(new Request("https://x"), { params: Promise.resolve({ slug: "demo", id: row!.id }) });
    const body = await res.json();
    expect(body.winnerRuleId).toBeNull();
  });

  it("GET traffic/stats summarises the window", async () => {
    const { GET } = await import("./stats/route");
    const res = await GET(new Request("https://x"), ctx("demo"));
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.matched).toBe(2);
    expect(body.unmatched).toBe(1);
    expect(body.statusClasses["5xx"]).toBe(1);
    expect(body.statusClasses["4xx"]).toBe(1);
    expect(body.topUnmatchedPaths).toEqual([{ path: "/nope", count: 1 }]);
  });
});
