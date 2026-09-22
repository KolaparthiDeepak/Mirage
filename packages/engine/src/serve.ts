// Plan 19 — a pure, store-free "serve one request" helper. `mirage dev`
// (packages/cli) uses this so its responses match the hosted route's
// mock-resolution behaviour exactly, for the one thing both can share: a
// config plus a request in, a Response out.
//
// Deliberately narrower than app/m/[...slug]/route.ts: no store, so no
// traffic recording, stateful variants, fault injection, contract checking,
// upstream proxying or callbacks — those are persistence/session features
// with no meaning for a stateless local file server. A consumer who needs
// them runs the hosted service; this is for "does my rule match and return
// what I expect", which needs none of that.
// Re-exported source, not copied: this package has no build step yet (see
// packages/engine/README.md) — it points straight at the main app's
// src/engine/*, which is the actual, tested source of truth.
import { parseRequest } from "../../../src/engine/request";
import { resolve } from "../../../src/engine/resolve";
import type { ProjectConfig } from "../../../src/engine/types";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "*",
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });
}

export interface ServeOutcome {
  response: Response;
  matchedRuleId: string | null;
  warnings: string[];
}

/** `subPath` is everything after "/m/<slug>", always starting with "/" — the
 *  same convention the hosted route uses, so a client only has to change its
 *  base URL to switch between `mirage dev` and the hosted service. */
export async function serveMock(project: ProjectConfig, req: Request, subPath: string): Promise<ServeOutcome> {
  if (subPath === "/__spec" && req.method === "GET") {
    const response =
      project.openApiDoc != null ? Response.json(project.openApiDoc) : json(404, { error: "no openapi spec", slug: project.slug });
    return { response, matchedRuleId: null, warnings: [] };
  }

  const cors = project.defaults.cors ? CORS_HEADERS : {};
  if (req.method === "OPTIONS" && project.defaults.cors) {
    return { response: new Response(null, { status: 204, headers: cors }), matchedRuleId: null, warnings: [] };
  }

  const parsed = await parseRequest(req, subPath);
  const result = resolve(parsed, project);

  if (result.delayMs > 0) {
    await new Promise((r) => setTimeout(r, Math.min(result.delayMs, 9000)));
  }

  const headers: Record<string, string> = {
    ...result.headers,
    ...cors,
    "x-mock-rule-id": result.matchedRuleId ?? "",
    "x-mock-matched": String(result.matchedRuleId !== null),
  };
  const payload =
    result.body === null || result.body === undefined
      ? null
      : typeof result.body === "string"
        ? result.body
        : JSON.stringify(result.body);

  return {
    response: new Response(payload, { status: result.status, headers }),
    matchedRuleId: result.matchedRuleId,
    warnings: result.warnings,
  };
}
