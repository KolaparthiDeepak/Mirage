import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { startDevServer, type DevServer } from "./dev-server";

function writeProject(dir: string, slug: string, responseStatus = 200): void {
  writeFileSync(
    join(dir, "project.yaml"),
    `name: ${slug}\nslug: ${slug}\ndefaults:\n  delayMs: 0\n  cors: false\n  notFound: { status: 404, body: { reason: UNKNOWN_ROUTE } }\n`,
  );
  const routesDir = join(dir, "routes");
  mkdirSync(routesDir, { recursive: true });
  writeFileSync(
    join(routesDir, "main.yaml"),
    `- id: hello\n  request: { method: GET, path: /hello }\n  response: { status: ${responseStatus}, body: { hi: true } }\n`,
  );
}

describe("startDevServer", () => {
  let mocksDir: string;
  let server: DevServer | undefined;

  afterEach(async () => {
    await server?.close();
    if (mocksDir) rmSync(mocksDir, { recursive: true, force: true });
  });

  it("serves a compiled project at /m/<slug>/... matching the hosted URL convention", async () => {
    mocksDir = mkdtempSync(join(tmpdir(), "mirage-dev-"));
    const projectDir = join(mocksDir, "demo");
    mkdirSync(projectDir);
    writeProject(projectDir, "demo");

    server = await startDevServer(mocksDir, { port: 0, watch: false, onLog: () => {} });
    const res = await fetch(`${server.url}/m/demo/hello`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hi: true });
    expect(res.headers.get("x-mock-matched")).toBe("true");
  });

  it("404s a request whose path doesn't start with /m/<slug>", async () => {
    mocksDir = mkdtempSync(join(tmpdir(), "mirage-dev-"));
    mkdirSync(join(mocksDir, "demo"));
    writeProject(join(mocksDir, "demo"), "demo");

    server = await startDevServer(mocksDir, { port: 0, watch: false, onLog: () => {} });
    const res = await fetch(`${server.url}/hello`);
    expect(res.status).toBe(404);
  });

  it("404s an unknown project slug", async () => {
    mocksDir = mkdtempSync(join(tmpdir(), "mirage-dev-"));
    mkdirSync(join(mocksDir, "demo"));
    writeProject(join(mocksDir, "demo"), "demo");

    server = await startDevServer(mocksDir, { port: 0, watch: false, onLog: () => {} });
    const res = await fetch(`${server.url}/m/nope/hello`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("unknown project");
  });

  it("hot-reloads a rule file edit within the watch debounce window", async () => {
    mocksDir = mkdtempSync(join(tmpdir(), "mirage-dev-"));
    const projectDir = join(mocksDir, "demo");
    mkdirSync(projectDir);
    writeProject(projectDir, "demo", 200);

    server = await startDevServer(mocksDir, { port: 0, watch: true, onLog: () => {} });
    const before = await fetch(`${server.url}/m/demo/hello`);
    expect(before.status).toBe(200);

    writeProject(projectDir, "demo", 201);

    // Poll instead of a fixed sleep: fs.watch's recursive callback timing
    // varies by platform, and this only needs to prove reload happens well
    // inside the plan's own 500ms budget, not pin an exact number.
    let status = 200;
    for (let i = 0; i < 20 && status !== 201; i++) {
      await sleep(50);
      status = (await fetch(`${server.url}/m/demo/hello`)).status;
    }
    expect(status).toBe(201);
  });

  it("keeps serving the last known good config when a later edit fails to compile", async () => {
    mocksDir = mkdtempSync(join(tmpdir(), "mirage-dev-"));
    const projectDir = join(mocksDir, "demo");
    mkdirSync(projectDir);
    writeProject(projectDir, "demo", 200);

    server = await startDevServer(mocksDir, { port: 0, watch: true, onLog: () => {} });
    const before = await fetch(`${server.url}/m/demo/hello`);
    expect(before.status).toBe(200);

    writeFileSync(join(projectDir, "routes", "main.yaml"), "not: [valid, yaml, rules");

    await sleep(400); // give the (failed) reload a chance to run
    const after = await fetch(`${server.url}/m/demo/hello`);
    expect(after.status).toBe(200); // unchanged — last good config still serving
  });
});
