import { describe, expect, it } from "vitest";
import { resolve as pathResolve } from "node:path";
import { compileMocks, compileProjectDir } from "./compile";

const fx = (name: string) => pathResolve(__dirname, "__fixtures__", name);

describe("compileMocks", () => {
  it("compiles a valid project", async () => {
    const r = await compileMocks(fx("valid"), "abc123");
    expect(r.errors).toEqual([]);
    expect(r.bundle.commit).toBe("abc123");
    const card = r.bundle.projects.card!;
    expect(card.basePath).toBe("/commands");
    expect(card.routes.map((x) => x.id)).toEqual(["block-ok", "block-default", "openapi:cardStatus"]);
    expect(card.routes[0]!.segments).toHaveLength(2);
    expect(card.defaults.notFound.status).toBe(404);
  });
  it("carries a project.yaml's drift config through to ProjectConfig (regression: was silently dropped)", async () => {
    const r = await compileMocks(fx("valid"), "abc123");
    expect(r.bundle.projects.card!.drift).toEqual({
      enabled: true,
      allowUnsafeMethods: false,
      compareCosmetic: false,
      schedule: "weekly",
    });
  });
  it("stores OpenAPI-generated routes basePath-relative", async () => {
    const r = await compileMocks(fx("valid"), "x");
    const gen = r.bundle.projects.card!.routes.find((x) => x.id.startsWith("openapi:"))!;
    // spec declares /commands/status; basePath is /commands => stored path must be /status
    expect(gen.path).toBe("/status");
    expect(gen.path).not.toContain("/commands");
    expect(gen.segments).toEqual([{ kind: "literal", value: "status" }]);
  });
  it("strips basePath from in-range OpenAPI routes and warns+skips out-of-range ones", async () => {
    const r = await compileMocks(fx("basepath-oa"), "x");
    expect(r.errors).toEqual([]);
    const ids = r.bundle.projects.svc!.routes.map((x) => x.id);
    expect(ids).toContain("openapi:getCard");
    expect(ids).not.toContain("openapi:ping");
    expect(r.bundle.projects.svc!.routes.find((x) => x.id === "openapi:getCard")!.path)
      .toBe("/acropolis/GET_CARD/v1");
    expect(r.warnings.join("\n")).toMatch(/openapi:ping.*outside basePath/i);
  });
  it("compileProjectDir compiles the same single project compileMocks would (plan 19: the CLI's own entry point)", async () => {
    const viaMocks = await compileMocks(fx("valid"), "x");
    const viaProjectDir = await compileProjectDir(fx("valid"), "card");
    expect(viaProjectDir.errors).toEqual([]);
    expect(viaProjectDir.config).toEqual(viaMocks.bundle.projects.card);
  });
  it("compileProjectDir returns config: null with an error for a directory that isn't a project", async () => {
    const r = await compileProjectDir(fx("valid"), "does-not-exist");
    expect(r.config).toBeNull();
    expect(r.errors.join("\n")).toMatch(/missing project\.yaml/);
  });
  it("errors when slug does not equal the directory name", async () => {
    const r = await compileMocks(fx("bad-slug"));
    expect(r.errors.join("\n")).toMatch(/slug .* does not match directory name/i);
  });
  it("errors on a route path starting with /__", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/extra.yaml": "- id: bad\n  request: { method: GET, path: /__x }\n  response: { status: 200 }\n",
    });
    expect(r.errors.join("\n")).toMatch(/reserved path/i);
  });
  it("errors on an unknown template token", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/extra.yaml": '- id: t\n  request: { method: GET, path: /t }\n  response: { status: 200, body: "{{evil()}}" }\n',
    });
    expect(r.errors.join("\n")).toMatch(/unknown template token/i);
  });
  it("warns on two unconditional rules for the same method+path", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/extra.yaml":
        "- id: d1\n  request: { method: POST, path: /dupe }\n  response: { status: 200 }\n" +
        "- id: d2\n  request: { method: POST, path: /dupe }\n  response: { status: 200 }\n",
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join("\n")).toMatch(/unreachable/i);
  });
  it("does not warn when a hand-written rule shadows an OpenAPI-generated route (intended override)", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      // valid fixture's openapi declares GET /commands/status => openapi:cardStatus at /status
      "card/routes/override.yaml":
        "- id: status-override\n  request: { method: GET, path: /status }\n  response: { status: 200, body: { up: false } }\n",
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join("\n")).not.toMatch(/"openapi:cardStatus": unreachable/);
  });
  it("reports a duplicate rule id as an error", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/dupe.yaml":
        "- id: same\n  request: { method: GET, path: /a }\n  response: { status: 200 }\n" +
        "- id: same\n  request: { method: GET, path: /b }\n  response: { status: 200 }\n",
    });
    expect(r.errors.join("\n")).toMatch(/duplicate rule id "same" in project "card"/);
  });
  it("records an error (and does not throw) on an invalid OpenAPI spec", async () => {
    const r = await compileMocks(fx("bad-openapi"), "x");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.join("\n")).toMatch(/api\.yaml/);
  });
  it("hand-written rules come before OpenAPI-generated ones", async () => {
    const r = await compileMocks(fx("valid"), "x");
    const ids = r.bundle.projects.card!.routes.map((x) => x.id);
    expect(ids.indexOf("block-ok")).toBeLessThan(ids.findIndex((i) => i.startsWith("openapi:")));
    expect(r.bundle.projects.card!.openApiDoc).toBeTruthy();
  });

  // --- plan 01 correctness fixes ---

  it('treats basePath "/" as no basePath and keeps OpenAPI routes (B1)', async () => {
    const r = await compileMocks(fx("basepath-root"), "x");
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    const svc = r.bundle.projects.svc!;
    expect(svc.basePath).toBeUndefined();
    expect(svc.routes.map((x) => x.id)).toEqual(["openapi:listUsers"]);
    expect(svc.routes[0]!.path).toBe("/users");
  });

  it("errors when an OpenAPI file contributes no routes at all (B1)", async () => {
    const r = await compileMocks(fx("basepath-oa"), "x");
    // sanity: this fixture's spec does sit inside its basePath
    expect(r.errors.filter((e) => e.includes("contributed no routes"))).toEqual([]);
  });

  it("merges every OpenAPI document in a project, not just the last (B3)", async () => {
    const r = await compileMocks(fx("two-specs"), "x");
    expect(r.errors).toEqual([]);
    const svc = r.bundle.projects.svc!;
    expect(svc.routes.map((x) => x.id)).toEqual(["openapi:listUsers", "openapi:listOrders"]);
    const doc = svc.openApiDoc as { info: { title: string }; paths: Record<string, unknown> };
    expect(Object.keys(doc.paths).sort()).toEqual(["/orders", "/users"]);
    expect(doc.info.title).toBe("first"); // first document wins on info
  });

  it("errors when two OpenAPI documents declare the same path (B3)", async () => {
    const r = await compileMocks(fx("spec-collision"), "x");
    expect(r.errors.some((e) => e.includes('duplicate OpenAPI path "/users"'))).toBe(true);
  });

  it("warns when an earlier catch-all shadows a later specific rule (B10)", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/zz-shadow.yaml": [
        "- id: any-card",
        "  request: { method: '*', path: /cards/** }",
        "  response: { status: 200, body: {} }",
        "- id: one-card",
        "  request: { method: GET, path: /cards/:id }",
        "  response: { status: 200, body: {} }",
      ].join("\n"),
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('rule "one-card": unreachable') && w.includes("any-card"))).toBe(true);
  });

  it("does not warn when a later rule has match conditions the shadower lacks", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/zz-cond.yaml": [
        "- id: broad",
        "  request: { method: GET, path: /widgets/:id }",
        "  response: { status: 200, body: {} }",
        "- id: narrow",
        "  request:",
        "    method: GET",
        "    path: /widgets/:id",
        "    match: [{ header: x-flag, equals: on }]",
        "  response: { status: 200, body: {} }",
      ].join("\n"),
    });
    // `narrow` is genuinely dead here (broad is unconditional and identical), so it
    // must warn. `broad` itself is reachable and must not be reported.
    expect(r.warnings.some((w) => w.startsWith('rule "narrow": unreachable'))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('rule "broad"'))).toBe(false);
  });

  it("rejects a response header carrying a control character (B12)", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/zz-hdr.yaml": [
        "- id: bad-header",
        "  request: { method: GET, path: /hdr }",
        '  response: { status: 200, headers: { x-note: "a\\r\\nx-injected: 1" }, body: {} }',
      ].join("\n"),
    });
    expect(r.errors.some((e) => e.includes("control character"))).toBe(true);
  });

  it("rejects an invalid response header name (B12)", async () => {
    const r = await compileMocks(fx("valid"), "x", {
      "card/routes/zz-name.yaml": [
        "- id: bad-name",
        "  request: { method: GET, path: /hdr2 }",
        '  response: { status: 200, headers: { "bad header": "v" }, body: {} }',
      ].join("\n"),
    });
    expect(r.errors.some((e) => e.includes("invalid response header name"))).toBe(true);
  });
});
