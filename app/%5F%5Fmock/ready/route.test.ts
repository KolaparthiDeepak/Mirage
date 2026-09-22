// Plan 24 — /__mock/ready: deployment gating.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("/__mock/ready", () => {
  // getRuntimeStore() caches a lazy singleton at module scope (by design —
  // see runtime-source.ts); each test here changes which store it should
  // construct, so each needs its own fresh module graph rather than reusing
  // whatever the previous test's dynamic import() already cached.
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    delete process.env.MIRAGE_DB_DRIVER;
  });

  it("is always ready in bundle mode — nothing here depends on a store", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ready: true, configSource: "bundle" });
  });

  it("is always ready in files mode — nothing here depends on a store either", async () => {
    process.env.MIRAGE_CONFIG_SOURCE = "files";
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ready: true, configSource: "files" });
  });

  describe("store mode", () => {
    let dir: string;

    afterAll(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    it("is ready when the store answers", async () => {
      dir = mkdtempSync(join(tmpdir(), "mirage-ready-"));
      process.env.MIRAGE_CONFIG_SOURCE = "store";
      process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");

      const { GET } = await import("./route");
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ready: true, configSource: "store" });
    });

    it("is not ready (503) when the store driver can't even construct", async () => {
      process.env.MIRAGE_CONFIG_SOURCE = "store";
      process.env.MIRAGE_DB_DRIVER = "postgres"; // DATABASE_URL unset -> createStore() throws
      delete process.env.DATABASE_URL;

      const { GET } = await import("./route");
      const res = await GET();
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.ready).toBe(false);
      expect(body.error).toMatch(/DATABASE_URL/);
    });
  });
});
