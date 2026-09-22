import { describe, expect, it } from "vitest";
import { resolve as pathResolve } from "node:path";
import { runValidate } from "./validate";

const fx = (name: string) => pathResolve(__dirname, "../../../src/compile/__fixtures__", name);

describe("runValidate", () => {
  it("is ok for a valid mocks directory and reports the project count", async () => {
    const result = await runValidate(fx("valid"));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.projectCount).toBe(1);
  });

  it("is not ok, with the errors, for a directory with a bad slug", async () => {
    const result = await runValidate(fx("bad-slug"));
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/slug .* does not match directory name/i);
  });

  it("is not ok for a mocks directory that doesn't exist", async () => {
    const result = await runValidate(fx("does-not-exist"));
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/mocks directory not found/i);
  });
});
