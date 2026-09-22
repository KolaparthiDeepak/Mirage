import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetFilesCache } from "./files-source";
import { configSource, getCurrentConfig } from "./runtime-source";

function writeProject(mocksDir: string, slug: string): void {
  const dir = join(mocksDir, slug);
  mkdirSync(join(dir, "routes"), { recursive: true });
  writeFileSync(
    join(dir, "project.yaml"),
    `name: ${slug}\nslug: ${slug}\ndefaults:\n  delayMs: 0\n  cors: false\n  notFound: { status: 404, body: { reason: UNKNOWN_ROUTE } }\n`,
  );
  writeFileSync(join(dir, "routes", "main.yaml"), "- id: hello\n  request: { method: GET, path: /hello }\n  response: { status: 200, body: { hi: true } }\n");
}

describe("configSource (plan 20)", () => {
  afterEach(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_MOCKS_DIR;
  });

  it("defaults to bundle with nothing set", () => {
    expect(configSource()).toBe("bundle");
  });

  it("MIRAGE_CONFIG_SOURCE=store wins outright", () => {
    process.env.MIRAGE_CONFIG_SOURCE = "store";
    expect(configSource()).toBe("store");
  });

  it("MIRAGE_MOCKS_DIR alone is enough to select files mode", () => {
    process.env.MIRAGE_MOCKS_DIR = "/some/mounted/mocks";
    expect(configSource()).toBe("files");
  });

  it("MIRAGE_CONFIG_SOURCE=files selects files mode even without MIRAGE_MOCKS_DIR", () => {
    process.env.MIRAGE_CONFIG_SOURCE = "files";
    expect(configSource()).toBe("files");
  });
});

describe("getCurrentConfig — files mode (plan 20)", () => {
  let mocksDir: string;

  beforeEach(() => {
    __resetFilesCache();
    mocksDir = mkdtempSync(join(tmpdir(), "mirage-runtime-files-"));
    process.env.MIRAGE_CONFIG_SOURCE = "files";
    process.env.MIRAGE_MOCKS_DIR = mocksDir;
  });
  afterEach(() => {
    delete process.env.MIRAGE_CONFIG_SOURCE;
    delete process.env.MIRAGE_MOCKS_DIR;
    rmSync(mocksDir, { recursive: true, force: true });
  });

  it("resolves a project from the mounted directory with no store involved", async () => {
    writeProject(mocksDir, "demo");
    const found = await getCurrentConfig("demo");
    expect(found?.config.routes.map((r) => r.id)).toEqual(["hello"]);
    expect(found?.configVersion).toBeNull(); // no version concept, same as bundle mode
  });

  it("returns undefined for an unknown slug", async () => {
    writeProject(mocksDir, "demo");
    expect(await getCurrentConfig("nope")).toBeUndefined();
  });
});
