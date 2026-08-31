import { describe, it, expect } from "vitest";
import { matchSummary } from "./match-summary";

describe("matchSummary", () => {
  it("returns the fallback text for an empty match array", () => {
    expect(matchSummary([])).toBe("fallback (any request)");
  });

  it("maps a jsonPath target, stripping the leading $.", () => {
    expect(matchSummary([{ jsonPath: "$.cardLast4", equals: "0001" }])).toBe(
      'body.cardLast4 = "0001"',
    );
  });

  it("keeps a non-$. jsonPath as-is minus a leading $", () => {
    expect(matchSummary([{ jsonPath: "$foo", exists: true }])).toBe("foo exists");
  });

  it("maps a header target", () => {
    expect(matchSummary([{ header: "X-Env", equals: "qa" }])).toBe('header.X-Env = "qa"');
  });

  it("maps a query target", () => {
    expect(matchSummary([{ query: "mode", notEquals: "live" }])).toBe('query.mode ≠ "live"');
  });

  it("renders the contains operator", () => {
    expect(matchSummary([{ jsonPath: "$.name", contains: "test" }])).toBe('body.name ⊃ "test"');
  });

  it("renders the regex operator", () => {
    expect(matchSummary([{ jsonPath: "$.id", regex: "^c" }])).toBe("body.id ~ /^c/");
  });

  it("renders exists: true as 'exists'", () => {
    expect(matchSummary([{ header: "Authorization", exists: true }])).toBe(
      "header.Authorization exists",
    );
  });

  it("renders exists: false as 'absent'", () => {
    expect(matchSummary([{ jsonPath: "$.token", exists: false }])).toBe("body.token absent");
  });

  it("joins multiple conditions with ' · '", () => {
    expect(
      matchSummary([
        { jsonPath: "$.a", equals: "1" },
        { header: "H", exists: true },
      ]),
    ).toBe('body.a = "1" · header.H exists');
  });
});
