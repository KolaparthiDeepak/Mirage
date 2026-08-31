import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { yamlScalar } from "./yaml-scalar";

describe("yamlScalar", () => {
  const cases: [string, string][] = [
    ["plain", "hello world"],
    ["quote", 'he said "hi"'],
    ["colon", "Cards: v2"],
    ["newline", "line one\nline two"],
    ["backslash", "a\\b"],
    ["tab", "a\tb"],
    ["control char", `a${String.fromCharCode(1)}b`],
  ];

  for (const [name, input] of cases) {
    it(`round-trips a ${name}`, () => {
      expect(parse(`v: ${yamlScalar(input)}`)).toEqual({ v: input });
    });
  }

  it("always double-quotes", () => {
    expect(yamlScalar("x").startsWith('"')).toBe(true);
    expect(yamlScalar("x").endsWith('"')).toBe(true);
  });
});
