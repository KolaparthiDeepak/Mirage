// Plan 22 — the drift cron sweep endpoint, against the real store.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { __resetRateLimit } from "@/src/proxy/rate-limit";
import { SqliteStore } from "@/src/store/sqlite";
import { clearConfigCache } from "@/src/store/config-cache";
import type { StoredProject } from "@/src/store/types";

const TOKEN = "test-admin-token";
const AUTH = { authorization: `Bearer ${TOKEN}` };

type FetchImpl = (url: URL | string, opts: RequestInit & { headers: Headers }) => Promise<Response>;
function fakeFetch(bodyText: string, status = 200) {
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

function project(overrides: Partial<StoredProject>): StoredProject {
  return {
    slug: "x",
    name: "X",
    defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { error: "nope" } } },
    source: "store",
    configVersion: 0,
    updatedAt: new Date(0).toISOString(),
    rules: [],
    ...overrides,
  };
}

describe("cron drift sweep (plan 22)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-cron-drift-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_ADMIN_TOKEN = TOKEN;
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    store = new SqliteStore(process.env.MIRAGE_DB_PATH);

    await store.saveProject(
      project({
        slug: "daily-proj",
        upstream: { url: "https://real-api.example.com", mode: "record", forwardAuth: false, timeoutMs: 5000 },
        drift: { enabled: true, allowUnsafeMethods: false, compareCosmetic: false, schedule: "daily" },
        rules: [
          {
            ruleId: "r1",
            position: 0,
            definition: { id: "r1", request: { method: "GET", path: "/x" }, response: { status: 200, body: { a: 1 } } },
          },
        ],
      }),
    );
    await store.saveProject(
      project({
        slug: "manual-proj",
        upstream: { url: "https://real-api.example.com", mode: "record", forwardAuth: false, timeoutMs: 5000 },
        drift: { enabled: true, allowUnsafeMethods: false, compareCosmetic: false, schedule: "manual" },
        rules: [
          {
            ruleId: "r1",
            position: 0,
            definition: { id: "r1", request: { method: "GET", path: "/x" }, response: { status: 200, body: { a: 1 } } },
          },
        ],
      }),
    );
  });

  beforeEach(() => __resetRateLimit());
  afterEach(() => {
    clearConfigCache();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await store.close();
    delete process.env.MIRAGE_DB_PATH;
    delete process.env.MIRAGE_ADMIN_TOKEN;
    delete process.env.MIRAGE_CONFIG_SOURCE;
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects the sweep with no bearer token", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("sweeps only projects with a non-manual schedule", async () => {
    vi.stubGlobal("fetch", fakeFetch(JSON.stringify({ a: 1, b: 2 }))); // additive drift
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x", { method: "POST", headers: AUTH }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.swept).toBe(1);
    expect(body.results[0]).toMatchObject({ slug: "daily-proj", checked: 1, findingsCount: 1 });

    expect(await store.getDriftReport("daily-proj", "r1")).not.toBeNull();
    expect(await store.getDriftReport("manual-proj", "r1")).toBeNull();
  });
});
