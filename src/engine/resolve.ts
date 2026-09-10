import { allMatch, matchPath, methodMatches } from "./match";
import { renderDeep, renderTemplate, type TemplateContext } from "./template";
import type { MockResponse, ParsedRequest, ProjectConfig, ResolveResult } from "./types";

/** Returns the basePath-relative path, or null when the request is outside the
 *  basePath entirely. Returning the path unchanged (as this did) let a request
 *  that omitted the basePath match a basePath-relative route and get a 200.
 *  Exported for explain.ts (plan 06) — one implementation, not two that can
 *  silently drift apart on exactly this kind of edge case. */
export function stripBasePath(path: string, basePath: string | undefined): string | null {
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(basePath + "/")) return path.slice(basePath.length);
  return null;
}

/** Exported for src/state/apply.ts (plan 10) — one implementation of
 *  response-building, whether the variant comes from resolve() or the state
 *  layer. */
export function buildResponse(
  response: MockResponse,
  ctx: TemplateContext,
  warnings: string[],
): { status: number; headers: Record<string, string>; body: unknown } {
  const body = response.body === undefined ? null : renderDeep(response.body, ctx, warnings);
  const headers: Record<string, string> = {};
  if (body !== null && typeof body === "object") headers["content-type"] = "application/json";
  else if (typeof body === "string") headers["content-type"] = "text/plain";
  for (const [k, v] of Object.entries(response.headers ?? {})) {
    headers[k.toLowerCase()] = renderTemplate(v, ctx, warnings);
  }
  return { status: response.status, headers, body };
}

function notFound(req: ParsedRequest, project: ProjectConfig, warnings: string[]): ResolveResult {
  const ctx: TemplateContext = { body: req.body, path: {}, query: req.query, header: req.headers };
  const built = buildResponse(project.defaults.notFound, ctx, warnings);
  return { ...built, matchedRuleId: null, delayMs: project.defaults.delayMs, warnings };
}

export function resolve(req: ParsedRequest, project: ProjectConfig): ResolveResult {
  const warnings: string[] = [];
  const path = stripBasePath(req.path, project.basePath);
  if (path === null) return notFound(req, project, warnings);

  for (const route of project.routes) {
    if (!methodMatches(route.method, req.method)) continue;
    const pm = matchPath(route.segments, path);
    if (!pm.matched) continue;
    if (!allMatch(route.match, req)) continue;

    const ctx: TemplateContext = { body: req.body, path: pm.params, query: req.query, header: req.headers };
    const built = buildResponse(route.response, ctx, warnings);
    return {
      ...built,
      matchedRuleId: route.id,
      delayMs: project.defaults.delayMs,
      warnings,
      // Plan 10: handed to the mock route for src/state/apply.ts; ignored here.
      matchedRoute: route,
      templateContext: ctx,
    };
  }

  return notFound(req, project, warnings);
}
