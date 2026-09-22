import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getFilesBundle, __resetFilesCache } from "./files-source";

function writeProject(mocksDir: string, slug: string, ruleBody: string): void {
  const dir = join(mocksDir, slug);
  mkdirSync(join(dir, "routes"), { recursive: true });
  writeFileSync(
    join(dir, "project.yaml"),
    `name: ${slug}\nslug: ${slug}\ndefaults:\n  delayMs: 0\n  cors: false\n  notFound: { status: 404, body: { reason: UNKNOWN_ROUTE } }\n`,
  );
  writeFileSync(join(dir, "routes", "main.yaml"), `- id: hello\n  request: { method: GET, path: /hello }\n  response: { status: 200, body: ${ruleBody} }\n`);
}

describe("getFilesBundle", () => {
  let mocksDir: string;

  beforeEach(() => {
    __resetFilesCache();
    mocksDir = mkdtempSync(join(tmpdir(), "mirage-files-source-"));
  });
  afterEach(() => rmSync(mocksDir, { recursive: true, force: true }));

  it("compiles a mounted mocks directory into a bundle", async () => {
    writeProject(mocksDir, "demo", "{ hi: true }");
    const bundle = await getFilesBundle(mocksDir);
    expect(bundle.projects.demo?.routes.map((r) => r.id)).toEqual(["hello"]);
  });

  it("caches within the TTL — a file edit isn't picked up immediately", async () => {
    writeProject(mocksDir, "demo", "{ v: 1 }");
    const first = await getFilesBundle(mocksDir);
    expect((first.projects.demo?.routes[0]?.response.body as { v: number }).v).toBe(1);

    writeProject(mocksDir, "demo", "{ v: 2 }");
    const second = await getFilesBundle(mocksDir);
    expect((second.projects.demo?.routes[0]?.response.body as { v: number }).v).toBe(1); // still cached
  });

  it("picks up an edit once the cache expires", async () => {
    vi.useFakeTimers();
    writeProject(mocksDir, "demo", "{ v: 1 }");
    await getFilesBundle(mocksDir);

    writeProject(mocksDir, "demo", "{ v: 2 }");
    vi.advanceTimersByTime(2100);

    const after = await getFilesBundle(mocksDir);
    vi.useRealTimers();
    expect((after.projects.demo?.routes[0]?.response.body as { v: number }).v).toBe(2);
  });

  it("on a compile error, serves the last good bundle instead of an empty one", async () => {
    vi.useFakeTimers();
    writeProject(mocksDir, "demo", "{ v: 1 }");
    await getFilesBundle(mocksDir);

    writeFileSync(join(mocksDir, "demo", "routes", "main.yaml"), "not: [valid");
    vi.advanceTimersByTime(2100);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const after = await getFilesBundle(mocksDir);
    errorSpy.mockRestore();
    vi.useRealTimers();
    expect(after.projects.demo?.routes.map((r) => r.id)).toEqual(["hello"]); // unchanged from the good compile
  });
});
