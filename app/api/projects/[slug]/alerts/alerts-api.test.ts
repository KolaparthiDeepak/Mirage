// Plan 21 — alerts API end to end, against the real store.
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

function validAlertBody(overrides: Record<string, unknown> = {}) {
  return {
    id: "unmatched-spike",
    name: "Unmatched spike",
    view: "unmatched",
    condition: { kind: "unmatched", gt: 5, windowMinutes: 10 },
    notify: { webhook: "https://hook.example.com/alert" },
    ...overrides,
  };
}

describe("alerts API (plan 21)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-alerts-api-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_ADMIN_TOKEN = TOKEN;
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    store = new SqliteStore(process.env.MIRAGE_DB_PATH);

    const project: StoredProject = {
      slug: "alertproj",
      name: "Alert Project",
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

  it("rejects writes with no bearer token", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x", { method: "POST", body: "{}" }), ctx({ slug: "alertproj" }));
    expect(res.status).toBe(401);
  });

  it("rejects an alert pointing at an unknown view", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(validAlertBody({ id: "bad-view", view: "nope" })) }),
      ctx({ slug: "alertproj" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown view/);
  });

  it("creates, fetches, patches and deletes an alert", async () => {
    const { POST } = await import("./route");
    const created = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(validAlertBody()) }),
      ctx({ slug: "alertproj" }),
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.alert).toMatchObject({ id: "unmatched-spike", enabled: true, currentlyFiring: false });

    const { GET, PATCH, DELETE } = await import("./[id]/route");
    const fetched = await GET(new Request("https://x", { headers: AUTH }), ctx({ slug: "alertproj", id: "unmatched-spike" }));
    expect((await fetched.json()).alert.cooldownMinutes).toBe(30);

    const patched = await PATCH(
      new Request("https://x", { method: "PATCH", headers: AUTH, body: JSON.stringify({ enabled: false, cooldownMinutes: 15 }) }),
      ctx({ slug: "alertproj", id: "unmatched-spike" }),
    );
    expect(patched.status).toBe(200);
    const patchedBody = await patched.json();
    expect(patchedBody.alert).toMatchObject({ enabled: false, cooldownMinutes: 15, name: "Unmatched spike" });

    const deleted = await DELETE(new Request("https://x", { method: "DELETE", headers: AUTH }), ctx({ slug: "alertproj", id: "unmatched-spike" }));
    expect(deleted.status).toBe(204);
    expect((await GET(new Request("https://x", { headers: AUTH }), ctx({ slug: "alertproj", id: "unmatched-spike" }))).status).toBe(404);
  });

  it("enforces the 10-alert-per-project cap on create, but not on update", async () => {
    const { POST } = await import("./route");
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(validAlertBody({ id: `cap-${i}` })) }),
        ctx({ slug: "alertproj" }),
      );
      expect(res.status).toBe(201);
    }

    const eleventh = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(validAlertBody({ id: "cap-10" })) }),
      ctx({ slug: "alertproj" }),
    );
    expect(eleventh.status).toBe(409);

    // Updating one of the 10 that already exist must not trip the cap.
    const update = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(validAlertBody({ id: "cap-0", name: "Renamed" })) }),
      ctx({ slug: "alertproj" }),
    );
    expect(update.status).toBe(200);

    for (let i = 0; i < 10; i++) await store.deleteAlert("alertproj", `cap-${i}`);
  });

  it("delivers a test notification without touching cooldown state", async () => {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      headers: new Headers(),
      body: new ReadableStream({ start: (c) => c.close() }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(validAlertBody({ id: "test-me" })) }),
      ctx({ slug: "alertproj" }),
    );

    const { POST: testRoute } = await import("./[id]/test/route");
    const res = await testRoute(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "alertproj", id: "test-me" }));
    expect(res.status).toBe(200);
    expect((await res.json()).delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { GET } = await import("./[id]/route");
    const after = await GET(new Request("https://x", { headers: AUTH }), ctx({ slug: "alertproj", id: "test-me" }));
    const afterBody = await after.json();
    expect(afterBody.alert.currentlyFiring).toBe(false);
    expect(afterBody.alert.lastFiredAt).toBeNull();

    await store.deleteAlert("alertproj", "test-me");
  });
});
