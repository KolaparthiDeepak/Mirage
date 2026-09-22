// Extracted out of compile.ts (2026-09-22): toRoute() itself has no
// dependency on @apidevtools/swagger-parser, but living in the same file as
// compileMocks()/expandOpenApi() meant every caller of toRoute() pulled in
// swagger-parser transitively — including src/drift/run.ts, reached from
// instrumentation.ts (plan 20) via src/platform/self-host-cron.ts. Next's
// dev-mode webpack config for the instrumentation entry point can't resolve
// swagger-parser's node:path/node:fs imports (it treats that entry as
// edge-compatible), which broke `npm run dev` outright with "Module not
// found: Can't resolve 'path'" the moment self-host-cron.ts existed, whether
// or not MIRAGE_SELF_HOST_CRON was ever turned on.
//
// compile.ts re-exports toRoute from here so every other existing caller is
// unaffected; only drift/run.ts imports it from here directly, to keep
// swagger-parser out of that path entirely rather than relying on dynamic
// import() to defer it (which doesn't reliably code-split the
// instrumentation entry the way it does a per-route serverless function).
import { compileSegments } from "../engine/match";
import type { Route } from "../engine/types";
import type { Rule } from "./schema";

export function toRoute(rule: Rule): Route {
  // Plan 10: a variant rule's default (and the value every resolve()-path
  // reader sees) is variant[0]. The state layer overrides it per session.
  const response = rule.response ?? rule.responses!.variants[0]!;
  return {
    id: rule.id,
    method: rule.request.method,
    path: rule.request.path,
    segments: compileSegments(rule.request.path),
    match: rule.request.match as Route["match"],
    response,
    responses: rule.responses,
    callback: rule.callback as Route["callback"],
    drift: rule.drift,
  };
}
