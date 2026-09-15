// Plan 22 — drift API end to end, against the real store and real engine.
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

type FetchImpl = (url: URL | string, opts: RequestInit & { headers: Headers }) => Promise<Response>;
function fakeFetchOnce(bodyText: string, status = 200) {
  return vi.fn<FetchImpl>((async () => ({
    status,
    headers: new Headers({ "content-type": "application/json" }),
    body: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(bodyText));
        c.close();
      },
    }),
  })) as unknown as FetchImpl);
}

describe("drift API (plan 22)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-drift-api-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_ADMIN_TOKEN = TOKEN;
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    store = new SqliteStore(process.env.MIRAGE_DB_PATH);

    const project: StoredProject = {
      slug: "driftproj",
      name: "Drift Project",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { error: "nope" } } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      upstream: { url: "https://real-api.example.com", mode: "record", forwardAuth: false, timeoutMs: 5000 },
      drift: { enabled: true, allowUnsafeMethods: false, compareCosmetic: false, schedule: "manual" },
      rules: [
        {
          ruleId: "get-card",
          position: 0,
          definition: {
            id: "get-card",
            request: { method: "GET", path: "/cards/:id" },
            response: { status: 200, body: { id: "card-1", status: "ACTIVE" } },
          },
        },
      ],
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

  it("rejects requests with no bearer token", async () => {
    const { POST } = await import("./check/route");
    const res = await POST(new Request("https://x", { method: "POST" }), ctx({ slug: "driftproj" }));
    expect(res.status).toBe(401);
  });

  it("runs a manual check, lists the resulting report, and it is dismissable", async () => {
    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-9" }))); // status missing
    const { POST: check } = await import("./check/route");
    const checkRes = await check(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "driftproj" }));
    expect(checkRes.status).toBe(200);
    const summary = await checkRes.json();
    expect(summary).toMatchObject({ checked: 1, findingsCount: 1 });

    const { GET: list } = await import("./route");
    const listRes = await list(new Request("https://x", { headers: AUTH }), ctx({ slug: "driftproj" }));
    const listBody = await listRes.json();
    expect(listBody.reports).toHaveLength(1);
    expect(listBody.reports[0]).toMatchObject({ id: "get-card", dismissed: false });

    const { POST: dismiss } = await import("./[id]/dismiss/route");
    const dismissRes = await dismiss(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "driftproj", id: "get-card" }));
    expect(dismissRes.status).toBe(200);
    expect((await dismiss(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "driftproj", id: "get-card" }))).status).toBe(200);

    const afterDismiss = await store.getDriftReport("driftproj", "get-card");
    expect(afterDismiss?.dismissed).toBe(true);
  });

  it("accepts upstream, updating the rule's response as a revertible change and clearing the report", async () => {
    // A field ("flagged") that's new upstream but not in the mock — a real
    // structural finding, unlike a same-shape value change (which produces
    // no finding at all with compareCosmetic off, and so nothing to accept).
    vi.stubGlobal("fetch", fakeFetchOnce(JSON.stringify({ id: "card-1", status: "BLOCKED", flagged: true })));
    const { POST: check } = await import("./check/route");
    await check(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "driftproj" }));

    const before = await store.listConfigEvents("driftproj");

    const { POST: accept } = await import("./[id]/accept/route");
    const acceptRes = await accept(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "driftproj", id: "get-card" }));
    expect(acceptRes.status).toBe(200);
    const acceptBody = await acceptRes.json();
    expect(acceptBody.rule.response).toEqual({ status: 200, body: { id: "card-1", status: "BLOCKED", flagged: true } });

    const project = await store.getProject("driftproj");
    expect(project?.rules.find((r) => r.ruleId === "get-card")?.definition.response).toEqual({
      status: 200,
      body: { id: "card-1", status: "BLOCKED", flagged: true },
    });
    expect(await store.getDriftReport("driftproj", "get-card")).toBeNull();

    const after = await store.listConfigEvents("driftproj");
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toMatchObject({ kind: "rule.update", targetId: "get-card" });
  });

  it("refuses to accept the reserved spec-drift report id", async () => {
    const { POST: accept } = await import("./[id]/accept/route");
    const res = await accept(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "driftproj", id: "__openapi_spec__" }));
    expect(res.status).toBe(400);
  });
});
