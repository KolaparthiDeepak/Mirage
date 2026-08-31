import { describe, expect, it } from "vitest";
import { statusKind } from "./status";

describe("statusKind", () => {
  it("maps by hundreds digit, else x", () => {
    expect(statusKind(200)).toBe("2");
    expect(statusKind(404)).toBe("4");
    expect(statusKind(500)).toBe("5");
    expect(statusKind(302)).toBe("x");
    expect(statusKind(101)).toBe("x");
  });
});
