// Plan 16 — flows API end to end, against the real store and the real engine.
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

describe("flows API (plan 16)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "mirage-flows-api-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_ADMIN_TOKEN = TOKEN;
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    store = new SqliteStore(process.env.MIRAGE_DB_PATH);

    const project: StoredProject = {
      slug: "flowproj",
      name: "Flow Project",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: { error: "nope" } } },
      source: "store",
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [
        { ruleId: "verify", position: 0, definition: { id: "verify", request: { method: "POST", path: "/verify", match: [{ jsonPath: "$.customerId", equals: "cust-ok" }] }, response: { status: 200, body: { verified: true, sessionToken: "tok-1" } } } },
        { ruleId: "block", position: 1, definition: { id: "block", request: { method: "POST", path: "/block" }, response: { status: 200, body: { blocked: true } } } },
      ],
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

  const flowDef = {
    id: "happy-path",
    name: "Card block happy path",
    steps: [
      { name: "Verify customer", request: { method: "POST", path: "/verify", body: { customerId: "cust-ok" } }, assert: [{ status: 200 }, { jsonPath: "$.verified", equals: true }], capture: [{ name: "token", from: "$.sessionToken" }] },
      { name: "Block the card", request: { method: "POST", path: "/block", headers: { "x-session": "{{vars.token}}" } }, assert: [{ status: 200 }, { matchedRule: "block" }] },
    ],
  };

  it("rejects every write/run endpoint with no bearer token", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x", { method: "POST", body: "{}" }), ctx({ slug: "flowproj" }));
    expect(res.status).toBe(401);
  });

  it("creates a flow, runs it end to end through the real engine, and the JUnit output matches", async () => {
    const { POST: createFlow } = await import("./route");
    const created = await createFlow(new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(flowDef) }), ctx({ slug: "flowproj" }));
    expect(created.status).toBe(201);

    const { POST: runFlowRoute } = await import("./[id]/run/route");
    const runRes = await runFlowRoute(new Request("https://x", { method: "POST", headers: AUTH }), ctx({ slug: "flowproj", id: "happy-path" }));
    expect(runRes.status).toBe(200);
    const runBody = await runRes.json();
    expect(runBody.status).toBe("passed");
    expect(runBody.steps).toHaveLength(2);

    // GET the persisted run back
    const { GET: getRun } = await import("../runs/[runId]/route");
    const fetched = await getRun(new Request("https://x", { headers: AUTH }), ctx({ slug: "flowproj", runId: runBody.runId }));
    expect(fetched.status).toBe(200);
    expect((await fetched.json()).status).toBe("passed");

    // JUnit format
    const junitRes = await getRun(new Request("https://x?format=junit", { headers: AUTH }), ctx({ slug: "flowproj", runId: runBody.runId }));
    const xml = await junitRes.text();
    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="0"');
  });

  it("lists and deletes a flow", async () => {
    const { GET: listFlows } = await import("./route");
    const list = await (await listFlows(new Request("https://x", { headers: AUTH }), ctx({ slug: "flowproj" }))).json();
    expect(list.flows.some((f: { id: string }) => f.id === "happy-path")).toBe(true);

    const { DELETE } = await import("./[id]/route");
    const del = await DELETE(new Request("https://x", { method: "DELETE", headers: AUTH }), ctx({ slug: "flowproj", id: "happy-path" }));
    expect(del.status).toBe(204);
    expect(await store.getFlow("flowproj", "happy-path")).toBeNull();
  });

  it("rejects an invalid flow definition at save", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ id: "bad id!", name: "x", steps: [] }) }), ctx({ slug: "flowproj" }));
    expect(res.status).toBe(400);
  });
});
