import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/mocks.generated.json", () => ({
  default: {
    builtAt: "2026-08-28T00:00:00.000Z", commit: "abc123", warnings: ["w1"],
    projects: {
      demo: { name: "Demo", slug: "demo", defaults: { delayMs: 0, cors: true, notFound: { status: 404 } },
              routes: [{ id: "a" }, { id: "b" }], openApiDoc: { openapi: "3.0.3" } },
      bare: { name: "Bare", slug: "bare", defaults: { delayMs: 0, cors: true, notFound: { status: 404 } }, routes: [] },
    },
  },
}));

describe("__mock endpoints", () => {
  it("health reports build info and the service name (plan 25)", async () => {
    const { GET } = await import("./route");
    expect(await (await GET()).json()).toEqual({
      ok: true, service: "mirage", builtAt: "2026-08-28T00:00:00.000Z", commit: "abc123", projectCount: 2, warnings: ["w1"],
      configSource: "bundle", store: { ok: true }, configCache: { hits: 0, misses: 0, hitRate: null, size: 0 },
    });
  });
  it("projects lists slug/name/routeCount/hasOpenApi", async () => {
    const { GET } = await import("../projects/route");
    expect(await (await GET()).json()).toEqual([
      { slug: "demo", name: "Demo", routeCount: 2, hasOpenApi: true },
      { slug: "bare", name: "Bare", routeCount: 0, hasOpenApi: false },
    ]);
  });

  it("in store mode, reports each project's live config version (plan 24)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mirage-health-store-"));
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");

    const { SqliteStore } = await import("@/src/store/sqlite");
    const seed = new SqliteStore(process.env.MIRAGE_DB_PATH);
    await seed.saveProject({
      slug: "live",
      name: "Live",
      defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: null } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [],
    });
    await seed.close();

    const { GET } = await import("./route");
    const body = await (await GET()).json();

    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    rmSync(dir, { recursive: true, force: true });

    expect(body.configSource).toBe("store");
    expect(body.store).toEqual({ ok: true });
    expect(body.projectVersions).toEqual({ live: 1 });
  });
});
