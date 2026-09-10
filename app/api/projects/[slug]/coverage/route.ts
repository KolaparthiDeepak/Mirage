// Plan 13.3 — GET /api/projects/:slug/coverage: which operations are mocked,
// exampled and exercised.
import { compileStoredProject } from "@/src/store/config-cache";
import { computeCoverage } from "@/src/contract/coverage";
import { getRuntimeStore } from "@/src/store/runtime-source";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  if (!project.openApiDoc) {
    return Response.json({ error: "project has no OpenAPI document" }, { status: 400 });
  }

  const routes = compileStoredProject(project).routes;

  // Last call per rule — a bounded recent scan, not a dedicated aggregate.
  const lastCalledByRuleId: Record<string, string> = {};
  try {
    const rows = await store.queryTraffic({ slug, limit: 1000 });
    for (const r of rows) {
      if (r.matchedRuleId && (!lastCalledByRuleId[r.matchedRuleId] || r.at > lastCalledByRuleId[r.matchedRuleId]!)) {
        lastCalledByRuleId[r.matchedRuleId] = r.at;
      }
    }
  } catch {
    /* coverage without "last called" is still useful */
  }

  return Response.json(computeCoverage(project.openApiDoc, routes, lastCalledByRuleId));
}
