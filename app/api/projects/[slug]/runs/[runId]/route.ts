// Plan 16 — GET /api/projects/:slug/runs/:runId : status + per-step results
// of a prior run. `?format=junit` returns the same run as JUnit XML.
import { toJUnitXml } from "@/src/flows/junit";
import type { StepResult } from "@/src/flows/run";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../_lib/admin-auth";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; runId: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, runId } = await ctx.params;

  const store = await getRuntimeStore();
  const run = await store.getFlowRun(slug, runId);
  if (!run) return Response.json({ error: "unknown run", runId }, { status: 404 });

  if (new URL(req.url).searchParams.get("format") === "junit") {
    const flow = await store.getFlow(slug, run.flowId);
    return new Response(toJUnitXml(flow?.name ?? run.flowId, run.results as StepResult[]), {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  }
  return Response.json(run);
}
