// Plan 10 — variant rules wired into the real mock route.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SqliteStore } from "@/src/store/sqlite";
import type { StoredProject } from "@/src/store/types";

vi.mock("next/server", () => ({ after: () => {} }));

describe("mock route — stateful variants (plan 10)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-route-stateful-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    process.env.MIRAGE_RECORD_TRAFFIC = "off";

    const seed = new SqliteStore(process.env.MIRAGE_DB_PATH);
    const project: StoredProject = {
      slug: "st",
      name: "Stateful",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: {} } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [
        {
          ruleId: "retry",
          position: 0,
          definition: {
            id: "retry",
            request: { method: "GET", path: "/retry" },
            responses: {
              strategy: "sequence",
              repeatLast: true,
              variants: [
                { status: 503, body: { error: "unavailable" } },
                { status: 503, body: { error: "unavailable" } },
                { status: 200, body: { ok: true } },
              ],
            },
          },
        },
      ],
    };
    await seed.saveProject(project);
    await seed.close();
  });

  afterAll(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_DB_PATH;
    delete process.env.MIRAGE_RECORD_TRAFFIC;
    rmSync(dir, { recursive: true, force: true });
  });

  async function call(session?: string) {
    const { GET } = await import("./route");
    const headers = session ? { "x-mirage-session": session } : undefined;
    const res = await GET(new Request("https://x/m/st/retry", { headers }), {
      params: Promise.resolve({ slug: ["st", "retry"] }),
    });
    return { status: res.status, variant: res.headers.get("x-mirage-variant") };
  }

  async function reset(session?: string) {
    const { POST } = await import("./route");
    const url = `https://x/m/st/__reset${session ? `?session=${session}` : ""}`;
    return POST(new Request(url, { method: "POST" }), { params: Promise.resolve({ slug: ["st", "__reset"] }) });
  }

  it("advances 503, 503, 200 then repeats 200", async () => {
    await reset();
    expect((await call()).status).toBe(503);
    expect((await call()).status).toBe(503);
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
  });

  it("two sessions do not consume each other's sequence", async () => {
    await reset();
    expect((await call("alice")).status).toBe(503); // alice #1
    expect((await call("bob")).status).toBe(503); // bob #1
    expect((await call("bob")).status).toBe(503); // bob #2
    expect((await call("bob")).status).toBe(200); // bob #3
    expect((await call("alice")).status).toBe(503); // alice #2 — unaffected by bob
  });

  it("__reset zeroes the counter; scoped reset touches one session only", async () => {
    await reset();
    await call("x");
    await call("x"); // x is now at 2
    await call("y"); // y is at 1

    const scoped = await reset("x");
    expect((await scoped.json()).session).toBe("x");
    expect((await call("x")).status).toBe(503); // x restarted
    expect((await call("y")).status).toBe(503); // y at 2, still a 503 (index 1)
  });

  it("MIRAGE_STATEFUL=off serves the first variant every time", async () => {
    process.env.MIRAGE_STATEFUL = "off";
    try {
      expect((await call()).status).toBe(503);
      expect((await call()).status).toBe(503);
    } finally {
      delete process.env.MIRAGE_STATEFUL;
    }
  });
});
