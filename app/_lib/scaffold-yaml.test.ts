import { describe, it, expect } from "vitest";
import {
  slugify,
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

describe("newProjectYaml", () => {
  it("emits a project.yaml stub for a known input", () => {
    expect(newProjectYaml({ name: "Card Service", slug: "card-service" })).toBe(
      `name: Card Service
slug: card-service
basePath: /
defaults:
  delayMs: 0
  cors: true
`,
    );
  });
});

describe("newEndpointYaml", () => {
  it("emits a routes list item for a known input", () => {
    expect(newEndpointYaml({ method: "POST", path: "/my/path" })).toBe(
      `- id: my-path-ok
  request:
    method: POST
    path: /my/path
  response: { status: 200, body: {} }
`,
    );
  });
});

describe("newCaseYaml", () => {
  it("embeds the raw body string and the given id/status/method/path", () => {
    expect(
      newCaseYaml({
        id: "card-blocked",
        status: 404,
        body: '{ "code": "NOT_FOUND" }',
        path: "/cards/block/v1",
        method: "POST",
      }),
    ).toBe(
      `- id: card-blocked
  request:
    method: POST
    path: /cards/block/v1
  response: { status: 404, body: { "code": "NOT_FOUND" } }
`,
    );
  });

  it("still embeds an unparseable body verbatim", () => {
    const out = newCaseYaml({
      id: "x",
      status: 200,
      body: "not json",
      path: "/x",
      method: "GET",
    });
    expect(out).toContain("body: not json }");
  });
});
