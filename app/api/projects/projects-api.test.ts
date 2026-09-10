// Plan 03: the write API, against a real seeded SQLite store — same pattern
// as app/m/[...slug]/route.store-source.test.ts and traffic-api.test.ts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { SqliteStore } from "@/src/store/sqlite";
import { clearConfigCache } from "@/src/store/config-cache";
import { projectYamlSchema, ruleSchema } from "@/src/compile/schema";
import type { StoredProject } from "@/src/store/types";

const TOKEN = "test-admin-token";
const AUTH = { authorization: `Bearer ${TOKEN}` };

function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

describe("projects write API (plan 03)", () => {
  let dir: string;
  let store: SqliteStore;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "mirage-projects-api-"));
    process.env.MIRAGE_DB_PATH = join(dir, "mirage.db");
    process.env.MIRAGE_ADMIN_TOKEN = TOKEN;
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    store = new SqliteStore(process.env.MIRAGE_DB_PATH);
  });

  afterEach(() => clearConfigCache());

  afterAll(async () => {
    await store.close();
    delete process.env.MIRAGE_DB_PATH;
    delete process.env.MIRAGE_ADMIN_TOKEN;
    delete process.env.MIRAGE_CONFIG_SOURCE;
    rmSync(dir, { recursive: true, force: true });
  });

  async function seedProject(slug: string, source: "store" | "repo" = "store"): Promise<StoredProject> {
    const project: StoredProject = {
      slug,
      name: "Test",
      defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
      source,
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [],
    };
    await store.saveProject(project);
    return (await store.getProject(slug))!;
  }

  it("POST /api/projects creates a project", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ name: "New", slug: "new-proj" }) }),
    );
    expect(res.status).toBe(201);
    expect(await store.getProject("new-proj")).not.toBeNull();
  });

  it("POST /api/projects 409s on a slug that already exists", async () => {
    await seedProject("dup");
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ name: "Dup", slug: "dup" }) }),
    );
    expect(res.status).toBe(409);
  });

  it("every write endpoint 401s with no bearer token", async () => {
    await seedProject("noauth");
    const cases: Array<() => Promise<Response>> = [
      async () => (await import("./route")).POST(new Request("https://x", { method: "POST", body: "{}" })),
      async () => (await import("./[slug]/route")).PATCH(new Request("https://x", { method: "PATCH", body: "{}" }), ctx({ slug: "noauth" })),
      async () => (await import("./[slug]/route")).DELETE(new Request("https://x", { method: "DELETE" }), ctx({ slug: "noauth" })),
      async () => (await import("./[slug]/rules/route")).POST(new Request("https://x", { method: "POST", body: "{}" }), ctx({ slug: "noauth" })),
      async () =>
        (await import("./[slug]/rules/[id]/route")).PATCH(new Request("https://x", { method: "PATCH", body: "{}" }), ctx({ slug: "noauth", id: "x" })),
      async () =>
        (await import("./[slug]/rules/[id]/route")).DELETE(new Request("https://x", { method: "DELETE" }), ctx({ slug: "noauth", id: "x" })),
      async () =>
        (await import("./[slug]/rules/reorder/route")).POST(new Request("https://x", { method: "POST", body: "{}" }), ctx({ slug: "noauth" })),
    ];
    for (const call of cases) {
      expect((await call()).status).toBe(401);
    }
  });

  it("repo-managed project 409s on every write endpoint", async () => {
    await seedProject("repoproj", "repo");
    const rulesRoute = await import("./[slug]/rules/route");
    const projectRoute = await import("./[slug]/route");
    const reorderRoute = await import("./[slug]/rules/reorder/route");

    const patchRes = await projectRoute.PATCH(
      new Request("https://x", { method: "PATCH", headers: AUTH, body: JSON.stringify({ name: "x" }) }),
      ctx({ slug: "repoproj" }),
    );
    expect(patchRes.status).toBe(409);

    const deleteRes = await projectRoute.DELETE(new Request("https://x", { method: "DELETE", headers: AUTH }), ctx({ slug: "repoproj" }));
    expect(deleteRes.status).toBe(409);

    const createRuleRes = await rulesRoute.POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "r", request: { method: "GET", path: "/x" }, response: { status: 200 } }),
      }),
      ctx({ slug: "repoproj" }),
    );
    expect(createRuleRes.status).toBe(409);

    const reorderRes = await reorderRoute.POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ ruleIds: [] }) }),
      ctx({ slug: "repoproj" }),
    );
    expect(reorderRes.status).toBe(409);
  });

  it("creates a rule and serves it at its URL within one cache TTL", async () => {
    await seedProject("live");
    const { POST } = await import("./[slug]/rules/route");
    const createRes = await POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "hello", request: { method: "GET", path: "/hello" }, response: { status: 200, body: { hi: true } } }),
      }),
      ctx({ slug: "live" }),
    );
    expect(createRes.status).toBe(201);

    const { GET } = await import("@/app/m/[...slug]/route");
    const mockRes = await GET(new Request("https://x/m/live/hello"), { params: Promise.resolve({ slug: ["live", "hello"] }) });
    expect(mockRes.status).toBe(200);
    expect(await mockRes.json()).toEqual({ hi: true });
  });

  it("rejects an unknown template token, writing nothing", async () => {
    await seedProject("badtoken");
    const { POST } = await import("./[slug]/rules/route");
    const res = await POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          id: "bad",
          request: { method: "GET", path: "/bad" },
          response: { status: 200, body: { x: "{{not.a.real.token}}" } },
        }),
      }),
      ctx({ slug: "badtoken" }),
    );
    expect(res.status).toBe(400);
    expect((await store.getProject("badtoken"))!.rules).toHaveLength(0);
  });

  it("returns a shadow warning when an earlier unconditional rule already matches everything", async () => {
    await seedProject("shadow");
    const rulesRoute = await import("./[slug]/rules/route");
    await rulesRoute.POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "broad", request: { method: "GET", path: "/widgets/:id" }, response: { status: 200 } }),
      }),
      ctx({ slug: "shadow" }),
    );
    const second = await rulesRoute.POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          id: "narrow",
          request: { method: "GET", path: "/widgets/:id", match: [{ header: "x-flag", equals: "on" }] },
          response: { status: 200 },
        }),
      }),
      ctx({ slug: "shadow" }),
    );
    const body = await second.json();
    expect(body.warning).toMatch(/narrow.*unreachable.*broad/s);
  });

  it("reorders rules and changes resolution order accordingly", async () => {
    await seedProject("order");
    const rulesRoute = await import("./[slug]/rules/route");
    await rulesRoute.POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "a", request: { method: "GET", path: "/x" }, response: { status: 201 } }),
      }),
      ctx({ slug: "order" }),
    );
    await rulesRoute.POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "b", request: { method: "GET", path: "/x" }, response: { status: 202 } }),
      }),
      ctx({ slug: "order" }),
    );

    const { GET } = await import("@/app/m/[...slug]/route");
    const before = await GET(new Request("https://x/m/order/x"), { params: Promise.resolve({ slug: ["order", "x"] }) });
    expect(before.status).toBe(201); // "a" was created first, wins first-match

    const reorderRoute = await import("./[slug]/rules/reorder/route");
    await reorderRoute.POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ ruleIds: ["b", "a"] }) }),
      ctx({ slug: "order" }),
    );
    clearConfigCache();
    const after = await GET(new Request("https://x/m/order/x"), { params: Promise.resolve({ slug: ["order", "x"] }) });
    expect(after.status).toBe(202); // "b" now wins
  });

  it("deletes a rule", async () => {
    await seedProject("del");
    const rulesRoute = await import("./[slug]/rules/route");
    await rulesRoute.POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "gone", request: { method: "GET", path: "/gone" }, response: { status: 200 } }),
      }),
      ctx({ slug: "del" }),
    );
    const { DELETE } = await import("./[slug]/rules/[id]/route");
    const res = await DELETE(new Request("https://x", { method: "DELETE", headers: AUTH }), ctx({ slug: "del", id: "gone" }));
    expect(res.status).toBe(204);
    expect((await store.getProject("del"))!.rules).toHaveLength(0);
  });

  it("PATCH /api/projects/:slug edits name and basePath", async () => {
    await seedProject("editme");
    const { PATCH } = await import("./[slug]/route");
    const res = await PATCH(
      new Request("https://x", { method: "PATCH", headers: AUTH, body: JSON.stringify({ name: "Edited", basePath: "/api" }) }),
      ctx({ slug: "editme" }),
    );
    expect(res.status).toBe(200);
    const updated = await store.getProject("editme");
    expect(updated!.name).toBe("Edited");
    expect(updated!.basePath).toBe("/api");
  });

  it("PATCH /api/projects/:slug rejects an upstream URL pointing at a private address (plan 07)", async () => {
    await seedProject("ssrf");
    const { PATCH } = await import("./[slug]/route");
    for (const url of ["https://169.254.169.254/latest/", "https://127.0.0.1/", "http://api.example.com"]) {
      const res = await PATCH(
        new Request("https://x", {
          method: "PATCH",
          headers: AUTH,
          body: JSON.stringify({ upstream: { url, mode: "record" } }),
        }),
        ctx({ slug: "ssrf" }),
      );
      expect(res.status).toBe(400);
    }
    expect((await store.getProject("ssrf"))!.upstream).toBeUndefined();
  });

  it("PATCH /api/projects/:slug clears upstream when mode is off (plan 07)", async () => {
    await seedProject("upoff");
    const { PATCH } = await import("./[slug]/route");
    const res = await PATCH(
      new Request("https://x", {
        method: "PATCH",
        headers: AUTH,
        body: JSON.stringify({ upstream: { url: "https://api.example.com", mode: "off" } }),
      }),
      ctx({ slug: "upoff" }),
    );
    expect(res.status).toBe(200);
    expect((await store.getProject("upoff"))!.upstream).toBeUndefined();
  });

  it("warns (default) then blocks (enforce) a rule that contradicts the OpenAPI spec (plan 13)", async () => {
    const openApiDoc = {
      openapi: "3.0.3",
      paths: {
        "/o": { post: { responses: { "201": { content: { "application/json": { schema: { type: "object", required: ["n"], properties: { n: { type: "integer" } } } } } } } } },
      },
    };
    await store.saveProject({
      slug: "contract",
      name: "C",
      defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: {} } },
      source: "store",
      openApiDoc,
      configVersion: 0,
      updatedAt: new Date(0).toISOString(),
      rules: [],
    });

    const { POST } = await import("./[slug]/rules/route");
    const bad = { id: "bad", request: { method: "POST", path: "/o" }, response: { status: 201, body: { n: "not-a-number" } } };

    // warn by default — the rule is still created
    const warnRes = await POST(new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify(bad) }), ctx({ slug: "contract" }));
    expect(warnRes.status).toBe(201);
    expect((await warnRes.json()).contractWarnings[0]).toMatch(/n: expected integer/);

    // enforce -> blocked
    const proj = await store.getProject("contract");
    await store.saveProject({ ...proj!, contract: { enforce: true, rejectInvalid: false } });
    clearConfigCache();
    const blockRes = await POST(
      new Request("https://x", { method: "POST", headers: AUTH, body: JSON.stringify({ ...bad, id: "bad2" }) }),
      ctx({ slug: "contract" }),
    );
    expect(blockRes.status).toBe(400);
  });

  it("rejects a rule whose response body references a secret variable (plan 17)", async () => {
    await seedProject("secrets");
    const projectRoute = await import("./[slug]/route");
    await projectRoute.PATCH(
      new Request("https://x", {
        method: "PATCH",
        headers: AUTH,
        body: JSON.stringify({ variables: [{ key: "apiKey", value: "sk-live-1", scope: "project", secret: true }] }),
      }),
      ctx({ slug: "secrets" }),
    );

    const { POST } = await import("./[slug]/rules/route");
    const res = await POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({ id: "leak", request: { method: "GET", path: "/leak" }, response: { status: 200, body: { k: "{{vars.apiKey}}" } } }),
      }),
      ctx({ slug: "secrets" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/secret variable "apiKey"/);
  });

  it("never returns a secret variable's value (plan 17)", async () => {
    await seedProject("secretread");
    const { PATCH } = await import("./[slug]/route");
    const res = await PATCH(
      new Request("https://x", {
        method: "PATCH",
        headers: AUTH,
        body: JSON.stringify({ variables: [{ key: "token", value: "sk-live-9", scope: "project", secret: true }] }),
      }),
      ctx({ slug: "secretread" }),
    );
    const returned = await res.json();
    expect(returned.variables[0].value).toBe("***");
    await PATCH(
      new Request("https://x", {
        method: "PATCH",
        headers: AUTH,
        body: JSON.stringify({ variables: [{ key: "token", value: "***", scope: "project", secret: true }] }),
      }),
      ctx({ slug: "secretread" }),
    );
    expect((await store.getProject("secretread"))!.variables![0]!.value).toBe("sk-live-9");
  });

  it("PATCH /api/projects/:slug 409s on a stale ifVersion", async () => {
    const project = await seedProject("staleversion");
    const { PATCH } = await import("./[slug]/route");
    const res = await PATCH(
      new Request("https://x", {
        method: "PATCH",
        headers: AUTH,
        body: JSON.stringify({ name: "x", ifVersion: project.configVersion + 999 }),
      }),
      ctx({ slug: "staleversion" }),
    );
    expect(res.status).toBe(409);
  });

  it("DELETE /api/projects/:slug removes the project", async () => {
    await seedProject("deleteme");
    const { DELETE } = await import("./[slug]/route");
    const res = await DELETE(new Request("https://x", { method: "DELETE", headers: AUTH }), ctx({ slug: "deleteme" }));
    expect(res.status).toBe(204);
    expect(await store.getProject("deleteme")).toBeNull();
  });

  it("GET /api/projects/:slug/export produces YAML valid against the exact schema the compiler uses", async () => {
    await seedProject("exportme");
    const rulesRoute = await import("./[slug]/rules/route");
    await rulesRoute.POST(
      new Request("https://x", {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          id: "ok",
          request: { method: "POST", path: "/verify", match: [{ jsonPath: "$.id", equals: "1" }] },
          response: { status: 200, body: { verified: true } },
        }),
      }),
      ctx({ slug: "exportme" }),
    );

    const { GET } = await import("./[slug]/export/route");
    const res = await GET(new Request("https://x"), ctx({ slug: "exportme" }));
    const files = (await res.json()) as Record<string, string>;

    const projectParsed = projectYamlSchema.safeParse(parseYaml(files["project.yaml"]!));
    expect(projectParsed.success).toBe(true);
    expect(projectParsed.success && projectParsed.data.slug).toBe("exportme");

    const rules = parseYaml(files["routes/main.yaml"]!);
    expect(rules).toHaveLength(1);
    for (const rule of rules) {
      expect(ruleSchema.safeParse(rule).success).toBe(true);
    }
  });
});
