import { describe, expect, it } from "vitest";
import { compareResponses } from "./compare";

describe("compareResponses", () => {
  it("reports breaking when the status class changes", () => {
    const findings = compareResponses({ status: 200, body: { ok: true } }, { status: 500, body: { error: "boom" } });
    expect(findings).toEqual([
      { severity: "breaking", path: "$.status", kind: "status-class-changed", detail: "mock returns 200, upstream returned 500" },
    ]);
  });

  it("reports no drift for identical shapes with different values", () => {
    const findings = compareResponses(
      { status: 200, body: { id: "abc-1", createdAt: "2020-01-01" } },
      { status: 200, body: { id: "xyz-9", createdAt: "2026-05-01" } },
    );
    expect(findings).toEqual([]);
  });

  it("reports breaking when a mock field is missing upstream", () => {
    const findings = compareResponses({ status: 200, body: { id: "1", name: "x" } }, { status: 200, body: { id: "1" } });
    expect(findings).toEqual([{ severity: "breaking", path: "$.name", kind: "missing-field", detail: '"name" is present in the mock but not upstream' }]);
  });

  it("reports breaking when a field's type changes", () => {
    const findings = compareResponses({ status: 200, body: { count: 5 } }, { status: 200, body: { count: "5" } });
    expect(findings).toEqual([{ severity: "breaking", path: "$.count", kind: "type-changed", detail: "number -> string" }]);
  });

  it("reports additive when upstream has a field the mock does not", () => {
    const findings = compareResponses({ status: 200, body: { id: "1" } }, { status: 200, body: { id: "1", newField: "x" } });
    expect(findings).toEqual([{ severity: "additive", path: "$.newField", kind: "new-field", detail: '"newField" is present upstream but not in the mock' }]);
  });

  it("ignores configured paths entirely", () => {
    const findings = compareResponses(
      { status: 200, body: { id: "1", timestamp: "2020-01-01" } },
      { status: 200, body: { id: "1" } }, // timestamp missing upstream too, but ignored
      { ignorePaths: ["$.timestamp"] },
    );
    expect(findings).toEqual([]);
  });

  it("finds nested drift inside objects and a representative array element", () => {
    const findings = compareResponses(
      { status: 200, body: { user: { id: "1" }, items: [{ price: 10 }] } },
      { status: 200, body: { user: { id: "1", role: "admin" }, items: [{ price: "10" }] } },
    );
    expect(findings).toEqual([
      { severity: "additive", path: "$.user.role", kind: "new-field", detail: '"role" is present upstream but not in the mock' },
      { severity: "breaking", path: "$.items[0].price", kind: "type-changed", detail: "number -> string" },
    ]);
  });

  it("reports cosmetic value differences only when compareCosmetic is on", () => {
    const off = compareResponses({ status: 200, body: { status: "PENDING" } }, { status: 200, body: { status: "DONE" } });
    expect(off).toEqual([]);

    const on = compareResponses(
      { status: 200, body: { status: "PENDING" } },
      { status: 200, body: { status: "DONE" } },
      { compareCosmetic: true },
    );
    expect(on).toEqual([{ severity: "cosmetic", path: "$.status", kind: "value-changed", detail: '"PENDING" -> "DONE"' }]);
  });

  it("treats null and undefined as the same type, and doesn't crash on either side being null", () => {
    const findings = compareResponses({ status: 200, body: { a: null } }, { status: 200, body: { a: null } });
    expect(findings).toEqual([]);
  });
});
