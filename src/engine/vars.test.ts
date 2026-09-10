import { describe, it, expect } from "vitest";
import { parseTemplate, renderDeep } from "./template";
import { resolve } from "./resolve";
import { compileSegments } from "./match";
import { collectVarRefs, resolveVars } from "./vars";
import type { ProjectConfig, ProjectVariable } from "./types";

const vars: ProjectVariable[] = [
  { key: "merchantName", value: "Acme", scope: "project" },
  { key: "riskScore", value: 12, scope: "project", overrides: { staging: 85 } },
  { key: "apiKey", value: "sk-live-xxx", scope: "project", secret: true },
];

describe("resolveVars", () => {
  it("applies an environment override, or the base value otherwise", () => {
    expect(resolveVars(vars, undefined).riskScore).toBe(12);
    expect(resolveVars(vars, "staging").riskScore).toBe(85);
    expect(resolveVars(vars, "prod").riskScore).toBe(12); // no override for prod
  });

  it("never exposes a secret", () => {
    expect("apiKey" in resolveVars(vars, "staging")).toBe(false);
  });
});

describe("collectVarRefs", () => {
  it("finds every {{vars.*}} key in a value tree", () => {
    expect([...collectVarRefs({ a: "{{vars.one}}", b: ["x {{vars.two}}", { c: "{{ vars.three }}" }] })].sort()).toEqual([
      "one",
      "three",
      "two",
    ]);
  });
});

describe("{{vars.*}} in the template grammar", () => {
  it("is an allowed token", () => {
    expect(() => parseTemplate("{{vars.merchantName}}")).not.toThrow();
  });

  it("renders from ctx.vars, and warns + empties when missing", () => {
    const w: string[] = [];
    const out = renderDeep(
      { m: "{{vars.merchantName}}", z: "{{vars.nope}}" },
      { body: null, path: {}, query: {}, header: {}, vars: { merchantName: "Acme" } },
      w,
    );
    expect(out).toEqual({ m: "Acme", z: "" });
    expect(w[0]).toMatch(/not found/);
  });
});

describe("resolve() resolves vars per environment", () => {
  function project(): ProjectConfig {
    return {
      name: "P",
      slug: "p",
      defaults: { delayMs: 0, cors: false, notFound: { status: 404, body: null } },
      variables: vars,
      routes: [
        {
          id: "get",
          method: "GET",
          path: "/m",
          segments: compileSegments("/m"),
          response: { status: 200, body: { merchant: "{{vars.merchantName}}", risk: "{{vars.riskScore}}" } },
        },
      ],
    };
  }

  const req = (headers: Record<string, string> = {}) => ({
    method: "GET",
    path: "/m",
    headers,
    query: {},
    body: undefined,
    rawBody: "",
  });

  it("uses the base value with no x-mirage-env", () => {
    const r = resolve(req() as never, project());
    expect(r.body).toEqual({ merchant: "Acme", risk: "12" });
  });

  it("uses the override when x-mirage-env matches", () => {
    const r = resolve(req({ "x-mirage-env": "staging" }) as never, project());
    expect(r.body).toEqual({ merchant: "Acme", risk: "85" });
  });
});
