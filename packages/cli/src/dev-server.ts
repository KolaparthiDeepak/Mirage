// Plan 19 — `mirage dev`: a real mock server on localhost, hot-reloading on
// file save, no cloud, no network. compileMocks() + node:http + a file
// watcher — the engine already does everything hard (per the plan itself).
//
// Deliberately narrow, matching @mirage/engine's serveMock: no store, so no
// traffic recording/stateful variants/faults/contract/upstream/callbacks —
// those need persistence this process doesn't have.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { serveMock } from "@mirage/engine";
import type { ProjectConfig } from "@mirage/engine";
import { compileMocks } from "../../../src/compile/compile";

async function nodeReqToWebRequest(req: IncomingMessage, base: string): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD" && chunks.length > 0;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
    else headers.set(k, v);
  }
  return new Request(new URL(req.url ?? "/", base), {
    method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(await response.text());
}

export interface DevServerOptions {
  port?: number;
  watch?: boolean;
  onLog?: (line: string) => void;
}

export interface DevServer {
  url: string;
  close: () => Promise<void>;
}

export async function startDevServer(mocksDir: string, opts: DevServerOptions = {}): Promise<DevServer> {
  const port = opts.port ?? 3100;
  const log = opts.onLog ?? ((line: string) => console.log(line));
  let projects: Record<string, ProjectConfig> = {};

  async function reload(): Promise<void> {
    const result = await compileMocks(mocksDir, "dev");
    // Same all-or-nothing contract as scripts/compile-cli.ts (the real
    // build): any error anywhere aborts adopting the new result, full stop —
    // never a partial config where the one project with the typo silently
    // serves whatever compileMocks happened to produce for it (which can be
    // a valid-but-emptied config, e.g. every rule file in it failed to
    // parse: still "no errors *for the project itself*", but not something
    // anyone asked to start serving). The whole previous `projects` map
    // keeps serving unchanged until the file is fixed.
    if (result.errors.length > 0) {
      log(`[mirage dev] compile error(s) — keeping last known good config:\n  ${result.errors.join("\n  ")}`);
      return;
    }
    projects = result.bundle.projects;
    log(`[mirage dev] compiled ${Object.keys(projects).length} project(s)${result.warnings.length > 0 ? `, ${result.warnings.length} warning(s)` : ""}`);
  }

  await reload();

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const webReq = await nodeReqToWebRequest(req, `http://localhost:${port}`);
        const url = new URL(webReq.url);
        const parts = url.pathname.split("/").filter((p) => p.length > 0);
        if (parts[0] !== "m" || parts.length < 2) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "expected /m/<slug>/..., matching the hosted service's URL convention" }));
          return;
        }
        const slug = parts[1]!;
        const project = projects[slug];
        if (!project) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "unknown project", slug }));
          return;
        }
        const subPath = "/" + parts.slice(2).join("/");
        const outcome = await serveMock(project, webReq, subPath);
        log(`${webReq.method} ${url.pathname} -> ${outcome.response.status} (${outcome.matchedRuleId ?? "unmatched"})`);
        await writeWebResponse(res, outcome.response);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
    })();
  });

  await new Promise<void>((res) => server.listen(port, res));
  const address = server.address();
  const boundPort = typeof address === "object" && address !== null ? address.port : port;

  let watcher: FSWatcher | undefined;
  if (opts.watch !== false) {
    let pending: NodeJS.Timeout | undefined;
    try {
      watcher = watch(mocksDir, { recursive: true }, () => {
        clearTimeout(pending);
        pending = setTimeout(() => {
          reload().catch((e: unknown) => log(`[mirage dev] reload failed: ${(e as Error).message}`));
        }, 80);
      });
    } catch (e) {
      log(`[mirage dev] file watching unavailable on this platform: ${(e as Error).message} — restart to pick up changes`);
    }
  }

  return {
    url: `http://localhost:${boundPort}`,
    close: () =>
      new Promise<void>((res, reject) => {
        watcher?.close();
        server.close((err) => (err ? reject(err) : res()));
      }),
  };
}
