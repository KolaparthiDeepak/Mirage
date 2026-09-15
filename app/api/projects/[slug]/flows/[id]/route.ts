// Plan 16 — GET one flow / DELETE it.
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../_lib/admin-auth";
import { requireStoreManaged } from "../../../../_lib/project-mutations";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;
  const store = await getRuntimeStore();
  const flow = await store.getFlow(slug, id);
  if (!flow) return Response.json({ error: "unknown flow", id }, { status: 404 });
  return Response.json({ flow: flow.definition, updatedAt: flow.updatedAt });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;
  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  await store.deleteFlow(slug, id);
  return new Response(null, { status: 204 });
}
