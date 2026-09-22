import { describe, expect, it, vi } from "vitest";
import { resolve as pathResolve } from "node:path";
import { main, resolveDevOptions } from "./cli";

const fx = (name: string) => pathResolve(__dirname, "../../../src/compile/__fixtures__", name);

function captureConsole() {
  const logs: string[] = [];
  const errs: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a) => { logs.push(a.join(" ")); });
  const error = vi.spyOn(console, "error").mockImplementation((...a) => { errs.push(a.join(" ")); });
  return { logs, errs, restore: () => { log.mockRestore(); error.mockRestore(); } };
}

describe("resolveDevOptions", () => {
  it("defaults to watch on, port 3100, mocksDir 'mocks'", () => {
    expect(resolveDevOptions([])).toEqual({ mocksDir: "mocks", port: 3100, watch: true });
  });

  it("--no-watch disables watching (regression: was silently ignored — flags.watch was never set by --no-watch)", () => {
    expect(resolveDevOptions(["--no-watch"]).watch).toBe(false);
  });

  it("reads a positional directory and --port", () => {
    expect(resolveDevOptions(["my-mocks", "--port", "4000"])).toEqual({ mocksDir: "my-mocks", port: 4000, watch: true });
  });
});

describe("mirage CLI dispatch", () => {
  it("validate exits 0 and reports the project count for a clean directory", async () => {
    const c = captureConsole();
    const code = await main(["validate", fx("valid")]);
    c.restore();
    expect(code).toBe(0);
    expect(c.logs.join("\n")).toMatch(/1 project\(s\) compiled cleanly/);
  });

  it("validate exits non-zero and prints errors for a broken directory", async () => {
    const c = captureConsole();
    const code = await main(["validate", fx("bad-slug")]);
    c.restore();
    expect(code).toBe(1);
    expect(c.errs.join("\n")).toMatch(/does not match directory name/);
  });

  it("prints usage and exits 0 with no command", async () => {
    const c = captureConsole();
    const code = await main([]);
    c.restore();
    expect(code).toBe(0);
    expect(c.errs.join("\n")).toMatch(/Usage: mirage/);
  });

  it("reports push/pull/tail/trace/flow-run as not yet implemented, exit 1", async () => {
    for (const argv of [["push"], ["pull"], ["tail"], ["trace", "abc"], ["flow", "run"]]) {
      const c = captureConsole();
      const code = await main(argv);
      c.restore();
      expect(code).toBe(1);
      expect(c.errs.join("\n")).toMatch(/not yet implemented/);
    }
  });

  it("an unknown command prints usage and exits non-zero", async () => {
    const c = captureConsole();
    const code = await main(["bogus"]);
    c.restore();
    expect(code).toBe(1);
    expect(c.errs.join("\n")).toMatch(/Usage: mirage/);
  });
});
