// Plan 11 — fault injection wired into the real mock route.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SqliteStore } from "@/src/store/sqlite";
import type { StoredProject } from "@/src/store/types";

vi.mock("next/server", () => ({ after: () => {} }));

async function seed(dbPath: string, faults: StoredProject["faults"]) {
  const s = new SqliteStore(dbPath);
  const project: StoredProject = {
    slug: "fx",
    name: "Faults",
    defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: {} } },
    source: "store",
    configVersion: 0,
    updatedAt: new Date(0).toISOString(),
    faults,
    rules: [
      { ruleId: "ok", position: 0, definition: { id: "ok", request: { method: "GET", path: "/ok" }, response: { status: 200, body: { ok: true } } } },
    ],
  };
  await s.saveProject(project);
  await s.close();
}

describe("mock route — fault injection (plan 11)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "mirage-route-faults-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    process.env.MIRAGE_RECORD_TRAFFIC = "off";
  });

  afterAll(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    delete process.env.MIRAGE_RECORD_TRAFFIC;
    delete process.env.MIRAGE_FAULTS;
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.resetModules();
  });

  async function call() {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/m/fx/ok"), { params: Promise.resolve({ slug: ["fx", "ok"] }) });
    return res.status;
  }

  it("faults.enabled:false is zero deviation from baseline", async () => {
    await seed(process.env.MIRAGE_DB_PATH!, { enabled: false, errorRate: { percent: 100, status: 503 } });
    for (let i = 0; i < 5; i++) expect(await call()).toBe(200);
  });

  it("a seeded 100% error rate injects the error every call, reproducibly after reset", async () => {
    await seed(process.env.MIRAGE_DB_PATH!, { enabled: true, seed: "s", errorRate: { percent: 100, status: 503 } });
    expect(await call()).toBe(503);
    expect(await call()).toBe(503);

    const { POST } = await import("./route");
    const resetRes = await POST(new Request("https://x/m/fx/__reset", { method: "POST" }), {
      params: Promise.resolve({ slug: ["fx", "__reset"] }),
    });
    expect(resetRes.status).toBe(200);
    expect(await call()).toBe(503);
  });

  it("MIRAGE_FAULTS=off dormant-ises the config", async () => {
    await seed(process.env.MIRAGE_DB_PATH!, { enabled: true, seed: "s", errorRate: { percent: 100, status: 503 } });
    process.env.MIRAGE_FAULTS = "off";
    try {
      expect(await call()).toBe(200);
    } finally {
      delete process.env.MIRAGE_FAULTS;
    }
  });
});
