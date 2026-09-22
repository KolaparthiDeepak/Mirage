import { describe, expect, it } from "vitest";
import { compileSegments } from "./match";
import { resolve } from "./resolve";
import { explain } from "./explain";
import type { ParsedRequest, ProjectConfig, Route } from "./types";

function route(over: Partial<Route> & Pick<Route, "id" | "method" | "path">): Route {
  return { segments: compileSegments(over.path), response: { status: 200, body: {} }, ...over };
}

function req(over: Partial<ParsedRequest> = {}): ParsedRequest {
  return { method: "GET", path: "/", headers: {}, query: {}, body: undefined, rawBody: "", ...over };
}

const project: ProjectConfig = {
  name: "Demo",
  slug: "demo",
  basePath: "/commands",
  defaults: { delayMs: 0, cors: true, notFound: { status: 404, body: { reason: "UNKNOWN_ROUTE" } } },
  routes: [
    route({
      id: "verify-ok",
      method: "POST",
      path: "/verify/:machine",
      match: [{ jsonPath: "$.customerId", equals: "cust-ok" }],
    }),
    route({ id: "verify-default", method: "POST", path: "/verify/:machine" }),
    route({
      id: "block-conditional",
      method: "POST",
      path: "/block",
      match: [{ header: "x-flag", notEquals: "off" }],
    }),
    route({ id: "widgets-wildcard", method: "GET", path: "/widgets/**" }),
    route({ id: "widgets-specific", method: "GET", path: "/widgets/:id" }),
  ],
};

describe("explain — property: winner always agrees with resolve()", () => {
  const corpus: ParsedRequest[] = [
    req({ method: "POST", path: "/commands/verify/m1", body: { customerId: "cust-ok" }, rawBody: "{}" }),
    req({ method: "POST", path: "/commands/verify/m1", body: { customerId: "other" }, rawBody: "{}" }),
    req({ method: "POST", path: "/commands/verify/m1", body: undefined, rawBody: "" }),
    req({ method: "POST", path: "/commands/block", headers: { "x-flag": "off" } }),
    req({ method: "POST", path: "/commands/block", headers: {} }),
    req({ method: "POST", path: "/commands/block", headers: { "x-flag": "on" } }),
    req({ method: "GET", path: "/commands/widgets/anything/goes/here" }),
    req({ method: "GET", path: "/commands/widgets/one-id" }),
    req({ method: "GET", path: "/verify/m1" }), // outside basePath
    req({ method: "DELETE", path: "/commands/verify/m1" }), // no method matches
    req({ method: "GET", path: "/commands/nope" }), // nothing matches at all
  ];

  it.each(corpus.map((r, i) => [i, r] as const))("request %i", (_i, r) => {
    const resolved = resolve(r, project);
    const explained = explain(r, project);
    expect(explained.winnerRuleId).toBe(resolved.matchedRuleId);
  });
});

describe("explain — hints", () => {
  it("outsideBasePath: request path missing the project's basePath", () => {
    const result = explain(req({ method: "POST", path: "/verify/m1" }), project);
    expect(result.outsideBasePath).toBe(true);
    expect(result.winnerRuleId).toBeNull();
    expect(result.traces).toEqual([]);
    expect(result.basePathHint).toMatch(/basePath/);
  });

  it("case-sensitivity: a path differing only in case is flagged, not silently 'path mismatch'", () => {
    const p: ProjectConfig = { ...project, routes: [route({ id: "only", method: "GET", path: "/Widgets" })] };
    const result = explain(req({ method: "GET", path: "/commands/widgets" }), p);
    expect(result.winnerRuleId).toBeNull();
    expect(result.traces[0]?.path).toBe("fail");
    expect(result.traces[0]?.hint).toMatch(/case-sensitive/);
  });

  it("does not fire the case-sensitivity hint on an unrelated path mismatch", () => {
    const p: ProjectConfig = { ...project, routes: [route({ id: "only", method: "GET", path: "/other" })] };
    const result = explain(req({ method: "GET", path: "/commands/widgets" }), p);
    expect(result.traces[0]?.hint).toBeUndefined();
  });

  it("trailing slash: noted as not the differentiator when the raw path differs only by one", () => {
    const p: ProjectConfig = { ...project, routes: [route({ id: "only", method: "GET", path: "/widgets/x" })] };
    const result = explain(req({ method: "GET", path: "/commands/widgets/x/" }), p);
    expect(result.winnerRuleId).toBe("only");
    expect(result.traces[0]?.hint).toMatch(/trailing slashes are ignored/);
  });

  it("does not fire the trailing-slash hint when the paths are identical", () => {
    const p: ProjectConfig = { ...project, routes: [route({ id: "only", method: "GET", path: "/widgets/x" })] };
    const result = explain(req({ method: "GET", path: "/commands/widgets/x" }), p);
    expect(result.traces[0]?.hint).toBeUndefined();
  });

  it("malformed body: a request-level hint, not attached to any one rule", () => {
    const result = explain(req({ method: "POST", path: "/commands/verify/m1", rawBody: "{not json", body: undefined }), project);
    expect(result.requestHints).toEqual(
      expect.arrayContaining([expect.stringMatching(/did not parse as JSON/)]),
    );
  });

  it("does not fire the malformed-body hint when there is no body at all", () => {
    const result = explain(req({ method: "GET", path: "/commands/widgets/x" }), project);
    expect(result.requestHints).toEqual([]);
  });

  it("shadowed-below: an unconditional winner that blocks a later, more specific rule", () => {
    const result = explain(req({ method: "GET", path: "/commands/widgets/anything" }), project);
    expect(result.winnerRuleId).toBe("widgets-wildcard");
    expect(result.traces.at(-1)?.hint).toMatch(/widgets-specific.*can never be reached/);
  });

  it("does not fire the shadowed-below hint when the winner has match conditions", () => {
    const result = explain(
      req({ method: "POST", path: "/commands/block", headers: { "x-flag": "on" } }),
      project,
    );
    expect(result.winnerRuleId).toBe("block-conditional");
    expect(result.traces.at(-1)?.hint).toBeUndefined();
  });

  it('fails-closed: notEquals on an absent header explains itself with "use exists: false"', () => {
    const result = explain(req({ method: "POST", path: "/commands/block", headers: {} }), project);
    const failing = result.traces.find((t) => t.ruleId === "block-conditional");
    expect(failing?.match).toBe("fail");
    expect(failing?.conditions?.[0]?.hint).toMatch(/exists: false/);
  });

  it("does not fire the fails-closed hint when the condition simply mismatches on a present value", () => {
    const result = explain(
      req({ method: "POST", path: "/commands/block", headers: { "x-flag": "off" } }),
      project,
    );
    const failing = result.traces.find((t) => t.ruleId === "block-conditional");
    expect(failing?.conditions?.[0]?.hint).toBeUndefined();
  });
});

describe("explain — general shape", () => {
  it("touches no network and does not mutate the project config", () => {
    const before = JSON.stringify(project);
    explain(req({ method: "POST", path: "/commands/verify/m1", body: { customerId: "cust-ok" } }), project);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("stops at the winner — does not evaluate routes after it", () => {
    const result = explain(
      req({ method: "POST", path: "/commands/verify/m1", body: { customerId: "cust-ok" } }),
      project,
    );
    expect(result.traces.map((t) => t.ruleId)).toEqual(["verify-ok"]);
  });

  it("reports every skipped rule up to the winner when the first rule fails", () => {
    const result = explain(
      req({ method: "POST", path: "/commands/verify/m1", body: { customerId: "someone-else" } }),
      project,
    );
    expect(result.traces.map((t) => t.ruleId)).toEqual(["verify-ok", "verify-default"]);
    expect(result.winnerRuleId).toBe("verify-default");
  });
});
