// Plan 21 — GET one saved view / DELETE it.
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../_lib/admin-auth";
import { requireStoreManaged } from "../../../../_lib/project-mutations";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;
  const store = await getRuntimeStore();
  const view = await store.getView(slug, id);
  if (!view) return Response.json({ error: "unknown view", id }, { status: 404 });
  return Response.json({ view: { id: view.id, name: view.name, query: view.query, createdAt: view.createdAt } });
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

  const inUse = (await store.listAlerts(slug)).find((a) => a.view === id);
  if (inUse) {
    return Response.json({ error: `view "${id}" is used by alert "${inUse.id}" — delete or repoint the alert first` }, { status: 409 });
  }

  await store.deleteView(slug, id);
  return new Response(null, { status: 204 });
}
