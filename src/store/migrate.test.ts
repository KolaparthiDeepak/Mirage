// Plan 24 regression: loadMigrations() used to readdirSync() the migrations
// directory, which Vercel's file tracer can't see — the first real deploy
// against Supabase failed with "ENOENT: ... scandir '.../migrations'" on
// every single store operation. Fixed by making the file list an explicit,
// static array; this test locks that in so a future "just readdirSync it,
// it's simpler" refactor doesn't quietly reintroduce the same bug.
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrations } from "./migrate";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

describe("loadMigrations", () => {
  it("returns every migration file on disk, for both dialects, with real content", () => {
    const onDisk = readdirSync(migrationsDir);
    for (const dialect of ["postgres", "sqlite"] as const) {
      const loaded = loadMigrations(dialect);
      const expectedCount = onDisk.filter((f) => f.endsWith(`.${dialect}.sql`)).length;
      expect(loaded.length).toBe(expectedCount);
      for (const m of loaded) {
        expect(m.sql.length).toBeGreaterThan(0);
        expect(onDisk).toContain(`${m.id}.${dialect}.sql`);
      }
    }
  });

  it("returns migrations in ascending numeric order (application order matters)", () => {
    const ids = loadMigrations("sqlite").map((m) => m.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it("postgres and sqlite variants declare the exact same set of migration ids", () => {
    const pgIds = loadMigrations("postgres").map((m) => m.id);
    const sqliteIds = loadMigrations("sqlite").map((m) => m.id);
    expect(pgIds).toEqual(sqliteIds);
  });
});
