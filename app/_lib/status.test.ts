import { describe, expect, it } from "vitest";
import { statusClass, statusKind } from "./status";

describe("statusClass", () => {
  it("maps by hundreds digit", () => {
    expect(statusClass(200)).toBe("mx-status--2");
    expect(statusClass(404)).toBe("mx-status--4");
    expect(statusClass(500)).toBe("mx-status--5");
  });
  it("falls back to the base class for anything else", () => {
    expect(statusClass(101)).toBe("mx-status");
    expect(statusClass(302)).toBe("mx-status");
  });
});

describe("statusKind", () => {
  it("maps by hundreds digit, else x", () => {
    expect(statusKind(200)).toBe("2");
    expect(statusKind(404)).toBe("4");
    expect(statusKind(500)).toBe("5");
    expect(statusKind(302)).toBe("x");
  });
});
