// Plan 22 — manually trigger a drift check for one project. Always allowed
// (the "manual" schedule is exactly this button); a no-op, cheaply, when
// drift isn't enabled or there's no active upstream.
import { runDriftCheck } from "@/src/drift/run";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../_lib/admin-auth";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;
  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });

  const summary = await runDriftCheck(store, project);
  return Response.json(summary);
}
