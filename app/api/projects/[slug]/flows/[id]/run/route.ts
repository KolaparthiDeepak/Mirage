// Plan 16 — run a flow. Synchronous within the request (execution is
// in-process against the engine, not a real HTTP round-trip, so a 50-step run
// completes well inside the 60s cap without needing a background queue).
// Both POST (the primary trigger) and GET (the plan's own curl example,
// `.../run?format=junit`) execute a fresh run; `?format=junit` on either
// returns JUnit XML instead of JSON. The run is persisted either way, so
// GET /api/projects/:slug/runs/:runId can fetch it again afterward.
import { randomUUID } from "node:crypto";
import { flowSchema } from "@/src/flows/schema";
import { runFlow } from "@/src/flows/run";
import { toJUnitXml } from "@/src/flows/junit";
import { compileStoredProject } from "@/src/store/config-cache";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../../_lib/admin-auth";

async function handleRun(req: Request, slug: string, id: string): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });

  const stored = await store.getFlow(slug, id);
  if (!stored) return Response.json({ error: "unknown flow", id }, { status: 404 });
  const flow = flowSchema.parse(stored.definition); // already validated at save

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  await store.saveFlowRun({ id: runId, slug, flowId: id, startedAt, finishedAt: null, status: "running", results: [] });

  const config = compileStoredProject(project);
  const outcome = await runFlow(config, flow, store, slug, runId);

  await store.saveFlowRun({
    id: runId,
    slug,
    flowId: id,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: outcome.status,
    results: outcome.steps,
  });

  const format = new URL(req.url).searchParams.get("format");
  if (format === "junit") {
    return new Response(toJUnitXml(flow.name, outcome.steps), {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  }
  return Response.json({ runId, status: outcome.status, steps: outcome.steps });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const { slug, id } = await ctx.params;
  return handleRun(req, slug, id);
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const { slug, id } = await ctx.params;
  return handleRun(req, slug, id);
}
