// Plan 02 step 4: proves the flag actually switches the mock route's data
// source, and that leaving it unset changes nothing (route.test.ts already
// covers the default path — this file only covers the non-default one, so the
// two never need to agree on the same mocks.generated.json mock).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SqliteStore } from "@/src/store/sqlite";
import type { StoredProject } from "@/src/store/types";

// after() needs Next's real request-scope context, unavailable when calling
// the handler directly. Captured here instead of fire-and-forgotten, so tests
// can deterministically await the traffic write plan 04 schedules through it.
const scheduled: Promise<unknown>[] = [];
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    scheduled.push(Promise.resolve(cb()));
  },
}));

describe("mock route — store-sourced (plan 02 step 4)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-route-store-"));
    const dbPath = join(dir, "mirage.db");
    // Read by runtime-source.ts's lazily-created store on first use, below.
    process.env.MIRAGE_DB_PATH = dbPath;
    process.env.MIRAGE_CONFIG_SOURCE = "store";

    const seed = new SqliteStore(dbPath);
    const project: StoredProject = {
      slug: "demo",
      name: "Demo",
      defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [
        {
          ruleId: "ok",
          position: 0,
          definition: {
            id: "ok",
            request: { method: "POST", path: "/verify", match: [{ jsonPath: "$.id", equals: "1" }] },
            response: { status: 200, body: { verified: true } },
          },
        },
      ],
    };
    await seed.saveProject(project);
    await seed.close(); // runtime-source.ts opens its own connection to the same file
  });

  afterAll(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  });

  it("serves a request from the store when MIRAGE_CONFIG_SOURCE=store", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x/m/demo/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "1" }),
      }),
      { params: Promise.resolve({ slug: ["demo", "verify"] }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
    expect(res.headers.get("x-mock-rule-id")).toBe("ok");
  });

  it("still 404s a project the store has never heard of", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x/m/ghost/x"), {
      params: Promise.resolve({ slug: ["ghost", "x"] }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "unknown project", slug: "ghost" });
  });

  // Plan 04's own first-listed test: "A mock request produces exactly one row
  // with the right rule id and status." recordTraffic's independent pieces
  // (redaction, truncation, sampling, the conformance suite) are unit-tested
  // elsewhere; this is the one place they're proven wired together correctly.
  it("records the request to the store via after()", async () => {
    scheduled.length = 0;
    const { POST } = await import("./route");
    await POST(
      new Request("https://x/m/demo/verify", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer secret" },
        body: JSON.stringify({ id: "1" }),
      }),
      { params: Promise.resolve({ slug: ["demo", "verify"] }) },
    );
    await Promise.all(scheduled);

    const store = await (await import("@/src/store/runtime-source")).getRuntimeStore();
    const rows = await store.queryTraffic({ slug: "demo" });
    const row = rows.find((r) => r.path === "/verify");
    expect(row).toBeDefined();
    expect(row!.matchedRuleId).toBe("ok");
    expect(row!.status).toBe(200);
    expect(row!.reqHeaders.authorization).toBe("***"); // redacted, not stored raw
  });
});
