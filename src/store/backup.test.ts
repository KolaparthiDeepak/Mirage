// Plan 24 — the restore drill, automated: write real data through the real
// driver, back it up while it's still open (the actual self-host scenario),
// destroy the original, restore, and prove the restored database is a
// working SqliteStore with the same data. "An untested backup is a belief,
// not a backup" — this runs on every commit, not once.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "./sqlite";
import { backupSqlite, restoreSqlite } from "./backup";
import type { StoredProject, TrafficEntry } from "./types";

describe("backupSqlite / restoreSqlite", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("restores a working store with the same data after the original is destroyed", async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-backup-drill-"));
    const sourcePath = join(dir, "mirage.db");
    const backupPath = join(dir, "mirage.backup.db");
    const restoredPath = join(dir, "mirage.restored.db");

    const store = new SqliteStore(sourcePath);
    const project: StoredProject = {
      slug: "p",
      name: "P",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: null } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [{ ruleId: "r1", position: 0, definition: { id: "r1", request: { method: "GET", path: "/x" }, response: { status: 200 } } }],
    };
    await store.saveProject(project);

    const traffic: TrafficEntry = {
      id: "t1", slug: "p", at: new Date().toISOString(), method: "GET", path: "/x",
      query: {}, reqHeaders: {}, reqBody: null, status: 200, resHeaders: {}, resBody: null,
      matchedRuleId: "r1", durationMs: 3, warnings: [], clientHash: null, configVersion: 1,
      truncated: false, viaUpstream: false, direction: "inbound",
    };
    await store.recordTraffic(traffic);

    // Back up while the store is still open — the actual self-host scenario.
    await backupSqlite(sourcePath, backupPath);

    await store.close();
    unlinkSync(sourcePath); // simulate total loss of the original

    restoreSqlite(backupPath, restoredPath);

    const restored = new SqliteStore(restoredPath);
    const restoredProject = await restored.getProject("p");
    const restoredTraffic = await restored.queryTraffic({ slug: "p" });
    await restored.close();

    expect(restoredProject?.name).toBe("P");
    expect(restoredProject?.rules.map((r) => r.ruleId)).toEqual(["r1"]);
    expect(restoredTraffic.map((t) => t.id)).toEqual(["t1"]);
  });

  it("refuses to back up onto an existing file", async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-backup-drill-"));
    const sourcePath = join(dir, "mirage.db");
    const store = new SqliteStore(sourcePath);
    await store.close();

    const backupPath = join(dir, "mirage.backup.db");
    await backupSqlite(sourcePath, backupPath);
    await expect(backupSqlite(sourcePath, backupPath)).rejects.toThrow(/already exists/);
  });

  it("refuses to restore onto an existing file without force", async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-backup-drill-"));
    const sourcePath = join(dir, "mirage.db");
    const store = new SqliteStore(sourcePath);
    await store.close();

    const backupPath = join(dir, "mirage.backup.db");
    await backupSqlite(sourcePath, backupPath);

    expect(() => restoreSqlite(backupPath, sourcePath)).toThrow(/already exists/);
    expect(() => restoreSqlite(backupPath, sourcePath, true)).not.toThrow();
  });
});
