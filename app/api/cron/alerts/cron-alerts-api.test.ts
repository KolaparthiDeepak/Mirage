// Plan 21 — the cron sweep endpoint, against the real store.
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

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

describe("cron alert sweep (plan 21)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-cron-alerts-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_ADMIN_TOKEN = TOKEN;
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    store = new SqliteStore(process.env.MIRAGE_DB_PATH);

    const project: StoredProject = {
      slug: "cronproj",
      name: "Cron Project",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { error: "nope" } } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [],
    };
    await store.saveProject(project);
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

  it("evaluates every enabled alert and notifies the ones that fire", async () => {
    const { POST: createAlert } = await import("../../projects/[slug]/alerts/route");
    await createAlert(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          id: "silence-check",
          name: "Silence check",
          view: "unmatched",
          // No traffic recorded at all for this project, so "silence" fires.
          condition: { kind: "silence", windowMinutes: 60 },
          notify: { webhook: "https://hook.example.com/silence" },
        }),
      }),
      ctx({ slug: "cronproj" }),
    );
    await createAlert(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          id: "disabled-one",
          name: "Disabled",
          view: "unmatched",
          condition: { kind: "silence", windowMinutes: 60 },
          notify: { webhook: "https://hook.example.com/disabled" },
          enabled: false,
        }),
      }),
      ctx({ slug: "cronproj" }),
    );

    const fetchMock = vi.fn(async () => ({
      status: 200,
      headers: new Headers(),
      body: new ReadableStream({ start: (c) => c.close() }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST: sweep } = await import("./route");
    const res = await sweep(new Request("https://x", { method: "POST", headers: AUTH }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Only the enabled alert is evaluated at all.
    expect(body.evaluated).toBe(1);
    expect(body.firing).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { GET: getAlert } = await import("../../projects/[slug]/alerts/[id]/route");
    const fired = await getAlert(new Request("https://x", { headers: AUTH }), ctx({ slug: "cronproj", id: "silence-check" }));
    expect((await fired.json()).alert.currentlyFiring).toBe(true);

    await store.deleteAlert("cronproj", "silence-check");
    await store.deleteAlert("cronproj", "disabled-one");
  });
});
