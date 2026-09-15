// Plan 21 — saved views API end to end, against the real store.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SqliteStore } from "@/src/store/sqlite";
import { clearConfigCache } from "@/src/store/config-cache";
import type { StoredProject } from "@/src/store/types";

vi.mock("next/server", () => ({ after: () => {} }));

const TOKEN = "test-admin-token";
const AUTH = { authorization: `Bearer ${TOKEN}` };

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

describe("saved views API (plan 21)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-views-api-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_ADMIN_TOKEN = TOKEN;
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    store = new SqliteStore(process.env.MIRAGE_DB_PATH);

    const project: StoredProject = {
      slug: "viewproj",
      name: "View Project",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { error: "nope" } } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [],
    };
    await store.saveProject(project);
  });

  afterEach(() => clearConfigCache());

  afterAll(async () => {
    await store.close();
    delete process.env.MIRAGE_DB_PATH;
    delete process.env.MIRAGE_ADMIN_TOKEN;
    delete process.env.MIRAGE_CONFIG_SOURCE;
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects writes with no bearer token", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x", { method: "POST", body: "{}" }), ctx({ slug: "viewproj" }));
    expect(res.status).toBe(401);
  });

  it("lists the 3 built-in views even with none saved", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://x", { headers: AUTH }), ctx({ slug: "viewproj" }));
    const body = await res.json();
    expect(body.builtin.map((v: { id: string }) => v.id)).toEqual(["unmatched", "errors", "slow"]);
    expect(body.saved).toEqual([]);
  });

  it("creates, fetches and deletes a saved view", async () => {
    const { POST } = await import("./route");
    const created = await POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "slow-orders", name: "Slow orders", query: { pathContains: "/orders", durationMsFrom: 500 } }),
      }),
      ctx({ slug: "viewproj" }),
    );
    expect(created.status).toBe(201);

    const { GET: getOne } = await import("./[id]/route");
    const fetched = await getOne(new Request("https://x", { headers: AUTH }), ctx({ slug: "viewproj", id: "slow-orders" }));
    expect(fetched.status).toBe(200);
    const fetchedBody = await fetched.json();
    expect(fetchedBody.view).toMatchObject({ name: "Slow orders", query: { pathContains: "/orders", durationMsFrom: 500 } });

    const { DELETE } = await import("./[id]/route");
    const deleted = await DELETE(new Request("https://x", { method: "DELETE", headers: AUTH }), ctx({ slug: "viewproj", id: "slow-orders" }));
    expect(deleted.status).toBe(204);
    expect((await getOne(new Request("https://x", { headers: AUTH }), ctx({ slug: "viewproj", id: "slow-orders" }))).status).toBe(404);
  });

  it("rejects a saved view id that collides with a built-in", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ id: "errors", name: "X", query: {} }) }),
      ctx({ slug: "viewproj" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/built-in/);
  });

  it("refuses to delete a view that an alert still references", async () => {
    const { POST: createView } = await import("./route");
    await createView(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ id: "in-use", name: "In use", query: {} }) }),
      ctx({ slug: "viewproj" }),
    );
    const { POST: createAlert } = await import("../alerts/route");
    await createAlert(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          id: "guard",
          name: "Guard",
          view: "in-use",
          condition: { kind: "silence", windowMinutes: 10 },
          notify: { webhook: "https://hook.example.com/x" },
        }),
      }),
      ctx({ slug: "viewproj" }),
    );

    const { DELETE } = await import("./[id]/route");
    const res = await DELETE(new Request("https://x", { method: "DELETE", headers: AUTH }), ctx({ slug: "viewproj", id: "in-use" }));
    expect(res.status).toBe(409);
  });
});
