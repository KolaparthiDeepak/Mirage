import { describe, expect, it } from "vitest";
import { parseHeaderLines, prettyBody, verdictText } from "./format";

describe("prettyBody", () => {
  it("pretty-prints JSON", () => {
    expect(prettyBody('{"a":1}')).toBe('{\n  "a": 1\n}');
  });
  it("returns non-JSON unchanged", () => {
    expect(prettyBody("<html>nope")).toBe("<html>nope");
  });
});

describe("verdictText", () => {
  it("labels each verdict kind with a semantic kind", () => {
    expect(verdictText({ kind: "hit", caseId: "x" })).toEqual({ text: "✓ matched case: x", kind: "hit" });
    expect(verdictText({ kind: "divert", landedOn: "y" }).kind).toBe("divert");
    expect(verdictText({ kind: "nomatch" }).kind).toBe("nomatch");
    expect(verdictText({ kind: "unknown" }).kind).toBe("unknown");
  });
});

describe("parseHeaderLines", () => {
  it("parses `k: v` lines, lowercasing keys, ignoring blanks", () => {
    expect(parseHeaderLines("Content-Type: application/json\n\nX-Tenant: acme")).toEqual({
      "content-type": "application/json",
      "x-tenant": "acme",
    });
  });
});
