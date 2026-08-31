import { describe, it, expect } from "vitest";
import { newId } from "./id";

describe("newId", () => {
  it("returns a non-empty string", () => {
    expect(typeof newId()).toBe("string");
    expect(newId().length).toBeGreaterThan(0);
  });

  it("returns a different value on each call", () => {
    expect(newId()).not.toBe(newId());
  });
});
