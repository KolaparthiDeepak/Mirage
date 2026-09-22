import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "./sqlite";
import { runStoreConformanceSuite } from "./conformance";

// In-memory: no file, no cleanup, fresh per test-file run — the SQLite driver
// is fully testable with no external service, which is the point of plan 02
// pulling it forward from plan 20 into here.
runStoreConformanceSuite("sqlite", () => new SqliteStore(":memory:"));

describe("SqliteStore construction (plan 24 regression)", () => {
  it("creates the parent directory when it doesn't exist yet — a fresh checkout's .data/ never exists on its own", async () => {
    const root = mkdtempSync(join(tmpdir(), "mirage-sqlite-ctor-"));
    const nested = join(root, "does", "not", "exist", "mirage.db");
    const store = new SqliteStore(nested); // must not throw
    await store.saveProject({
      slug: "p", name: "P", defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: null } },
      source: "store", configVersion: 0, updatedAt: new Date(0).toISOString(), rules: [],
    });
    expect(await store.getProject("p")).not.toBeNull();
    await store.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("still works with :memory: and an empty-string path (no directory to create)", () => {
    expect(() => new SqliteStore(":memory:")).not.toThrow();
  });
});
