import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { ruleYaml } from "./rule-yaml";

describe("ruleYaml", () => {
  it("emits a routes/*.yaml list item for a body + header condition", () => {
    const out = ruleYaml(
      [
        { field: "body.cardLast4", op: "equals", value: "0001" },
        { field: "header.X-Env", op: "contains", value: "qa" },
      ],
      "locate-card-not-found",
      "POST",
      "/acropolis-card-mgmt/GET_CARD/v1",
    );
    expect(out).toBe(
      `- id: "locate-card-not-found"
  request:
    method: "POST"
    path: "/acropolis-card-mgmt/GET_CARD/v1"
    match: [{ jsonPath: $.cardLast4, equals: "0001" }, { header: X-Env, contains: "qa" }]
  response: { status: 200, body: {} }
`,
    );
  });

  it("omits the match line when there are no conditions", () => {
    const out = ruleYaml([], "fallback-case", "GET", "/thing/v1");
    expect(out).toBe(
      `- id: "fallback-case"
  request:
    method: "GET"
    path: "/thing/v1"
  response: { status: 200, body: {} }
`,
    );
    expect(out).not.toContain("match:");
  });

  it("renders the exists op with no value and maps a bare field to jsonPath", () => {
    const out = ruleYaml(
      [{ field: "cardId", op: "exists", value: "" }],
      "has-card-id",
      "POST",
      "/x/v1",
    );
    expect(out).toContain("match: [{ jsonPath: $.cardId, exists: true }]");
  });

  it("maps query.X to a query target", () => {
    const out = ruleYaml(
      [{ field: "query.mode", op: "notEquals", value: "live" }],
      "c",
      "POST",
      "/x/v1",
    );
    expect(out).toContain(`{ query: mode, notEquals: "live" }`);
  });

  it("escapes a value containing a double quote so it stays one condition", () => {
    const out = ruleYaml(
      [{ field: "body.msg", op: "equals", value: 'he said "hi"' }],
      "c",
      "POST",
      "/x/v1",
    );
    expect(out).toContain(String.raw`equals: "he said \"hi\""`);
    const match = parse(out)[0].request.match;
    expect(match).toEqual([{ jsonPath: "$.msg", equals: 'he said "hi"' }]);
  });

  it("escapes a value containing a newline — stays one condition, no injected keys", () => {
    const out = ruleYaml(
      [{ field: "body.msg", op: "equals", value: "a\nstatus: 500" }],
      "c",
      "POST",
      "/x/v1",
    );
    const doc = parse(out)[0];
    expect(doc.request.match).toEqual([{ jsonPath: "$.msg", equals: "a\nstatus: 500" }]);
    expect(doc.response).toEqual({ status: 200, body: {} });
  });

  it("skips a field that would inject YAML, keeping only the valid condition", () => {
    const out = ruleYaml(
      [
        { field: 'a }, { jsonPath: $.b, exists: "c', op: "equals", value: "x" },
        { field: "body.ok", op: "equals", value: "y" },
      ],
      "c",
      "POST",
      "/x/v1",
    );
    expect(out).toContain("# invalid field");
    // the injected object never reaches the parsed match array
    expect(parse(out)[0].request.match).toEqual([
      { jsonPath: "$.ok", equals: "y" },
    ]);
  });
});
