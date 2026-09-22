// Plan 21 — GET one alert / PATCH (partial update, evaluation state
// untouched) / DELETE.
import { resolveBuiltinViewQuery } from "@/src/views/builtins";
import { alertPatchSchema } from "@/src/views/schema";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../_lib/admin-auth";
import { requireStoreManaged } from "../../../../_lib/project-mutations";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;
  const store = await getRuntimeStore();
  const alert = await store.getAlert(slug, id);
  if (!alert) return Response.json({ error: "unknown alert", id }, { status: 404 });
  return Response.json({ alert });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const parsed = alertPatchSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return Response.json({ error: `${issue.path.join(".") || "alert"}: ${issue.message}` }, { status: 400 });
  }

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const existing = await store.getAlert(slug, id);
  if (!existing) return Response.json({ error: "unknown alert", id }, { status: 404 });

  const view = parsed.data.view ?? existing.view;
  if (!resolveBuiltinViewQuery(view) && !(await store.getView(slug, view))) {
    return Response.json({ error: `unknown view "${view}"` }, { status: 400 });
  }

  await store.saveAlert({
    ...existing,
    name: parsed.data.name ?? existing.name,
    view,
    condition: parsed.data.condition ?? existing.condition,
    notify: parsed.data.notify ?? existing.notify,
    cooldownMinutes: parsed.data.cooldownMinutes ?? existing.cooldownMinutes,
    enabled: parsed.data.enabled ?? existing.enabled,
    updatedAt: new Date().toISOString(),
  });

  const saved = await store.getAlert(slug, id);
  return Response.json({ alert: saved });
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

  await store.deleteAlert(slug, id);
  return new Response(null, { status: 204 });
}
