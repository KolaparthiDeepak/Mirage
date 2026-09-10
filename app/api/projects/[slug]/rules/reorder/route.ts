// Plan 03: POST /api/projects/:slug/rules/reorder — { ruleIds: string[] }.
// Reassigns `position` by array index. `ruleIds` must be an exact permutation
// of the project's current rule ids — a partial or foreign list is rejected
// rather than silently reordering only what it recognises, since first-
// match-wins makes a wrong order a correctness bug, not a display glitch.
import { invalidateConfig } from "@/src/store/config-cache";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../_lib/admin-auth";
import { requireStoreManaged } from "../../../../_lib/project-mutations";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const ruleIds = (body as { ruleIds?: unknown }).ruleIds;
  if (!Array.isArray(ruleIds) || !ruleIds.every((id) => typeof id === "string")) {
    return Response.json({ error: "ruleIds must be a string array" }, { status: 400 });
  }

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const current = new Set(project.rules.map((r) => r.ruleId));
  const requested = new Set(ruleIds as string[]);
  const sameSet = current.size === requested.size && [...current].every((id) => requested.has(id));
  if (!sameSet) {
    return Response.json({ error: "ruleIds must be an exact permutation of the project's current rule ids" }, { status: 400 });
  }

  const byId = new Map(project.rules.map((r) => [r.ruleId, r]));
  const rules = (ruleIds as string[]).map((id, position) => ({ ...byId.get(id)!, position }));
  await store.saveProject({ ...project, rules });
  invalidateConfig(slug);
  return Response.json({ ok: true });
}
