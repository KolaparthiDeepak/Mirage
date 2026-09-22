import { describe, expect, it, vi } from "vitest";
import { selfHostAfter } from "./after";

describe("selfHostAfter", () => {
  it("runs the work and does not block the caller on it", () => {
    let ran = false;
    selfHostAfter(async () => {
      await new Promise((r) => setTimeout(r, 5));
      ran = true;
    });
    expect(ran).toBe(false); // fire-and-forget: not awaited
  });

  it("eventually runs synchronous work too", async () => {
    let ran = false;
    selfHostAfter(() => {
      ran = true;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(ran).toBe(true);
  });

  it("logs, never throws, when the work rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      selfHostAfter(() => {
        throw new Error("boom");
      }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("boom"));
    errorSpy.mockRestore();
  });
});
