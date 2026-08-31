import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import {
  slugify,
  jsonBodyOrEmpty,
  newProjectYaml,
  newEndpointYaml,
  newCaseYaml,
} from "./scaffold-yaml";

describe("slugify", () => {
  it("lowercases, replaces punctuation, collapses and trims", () => {
    expect(slugify("Card Service!")).toBe("card-service");
    expect(slugify("  Multi   Word -- name  ")).toBe("multi-word-name");
    expect(slugify("Already-ok")).toBe("already-ok");
  });
});

describe("jsonBodyOrEmpty", () => {
  it("normalises valid JSON to one line", () => {
    expect(jsonBodyOrEmpty('{\n  "a": 1\n}')).toEqual({
      text: '{"a":1}',
      valid: true,
    });
  });
  it("falls back to {} and flags invalid input", () => {
    expect(jsonBodyOrEmpty("not json")).toEqual({ text: "{}", valid: false });
  });
});

describe("newProjectYaml", () => {
  it("emits a project.yaml stub with a quoted name", () => {
    expect(newProjectYaml({ name: "Card Service", slug: "card-service" })).toBe(
      `name: "Card Service"
slug: card-service
basePath: /
defaults:
  delayMs: 0
  cors: true
`,
    );
  });
  it("stays valid YAML for a name with a colon", () => {
    expect(parse(newProjectYaml({ name: "API: v2", slug: "api" })).name).toBe(
      "API: v2",
    );
  });
});

describe("newEndpointYaml", () => {
  it("emits a routes list item whose id includes the method", () => {
    expect(newEndpointYaml({ method: "POST", path: "/my/path" })).toBe(
      `- id: post-my-path-ok
  request:
    method: POST
    path: "/my/path"
  response: { status: 200, body: {} }
`,
    );
  });
});

describe("newCaseYaml", () => {
  it("embeds normalised JSON and quoted id/path", () => {
    const out = newCaseYaml({
      id: "card-blocked",
      status: 404,
      body: '{ "code": "NOT_FOUND" }',
      path: "/cards/block/v1",
      method: "POST",
    });
    expect(out).toBe(
      `- id: "card-blocked"
  request:
    method: POST
    path: "/cards/block/v1"
  response: { status: 404, body: {"code":"NOT_FOUND"} }
`,
    );
    expect(parse(out)[0].response.body).toEqual({ code: "NOT_FOUND" });
  });

  it("falls back to {} for an unparseable body", () => {
    const out = newCaseYaml({
      id: "x",
      status: 200,
      body: "not json",
      path: "/x",
      method: "GET",
    });
    expect(out).toContain("body: {} }");
  });
});
