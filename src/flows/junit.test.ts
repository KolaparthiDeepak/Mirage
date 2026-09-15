import { describe, it, expect } from "vitest";
import { toJUnitXml } from "./junit";
import type { StepResult } from "./run";

// No XML library is a dependency here — this checks structure with a minimal
// tag count rather than adding one for a single test file.
function countTags(xml: string, tag: string): number {
  return (xml.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
}

describe("toJUnitXml", () => {
  const steps: StepResult[] = [
    { name: "ok", method: "GET", path: "/a", status: 200, matchedRuleId: "r1", durationMs: 12, assertions: [{ description: "status equals 200", passed: true }], passed: true },
    {
      name: "bad",
      method: "GET",
      path: "/b",
      status: 500,
      matchedRuleId: "r2",
      durationMs: 5,
      assertions: [{ description: "status equals 200", passed: false, expected: 200, actual: 500 }],
      passed: false,
    },
    { name: "threw", method: "GET", path: "/c", status: 0, matchedRuleId: null, durationMs: 1, assertions: [], passed: false, error: "boom" },
  ];

  it("reports the correct pass/fail/error counts", () => {
    const xml = toJUnitXml("My Flow", steps);
    expect(xml).toContain('tests="3"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('errors="1"');
    expect(countTags(xml, "testcase")).toBe(3);
  });

  it("escapes special characters and includes the failure message", () => {
    const xml = toJUnitXml('Flow "with quotes" & <brackets>', steps);
    expect(xml).toContain("&quot;with quotes&quot;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;brackets&gt;");
    expect(xml).toContain("expected 200, got 500");
  });
});
