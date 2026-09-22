// Plan 15 — POST /api/projects/:slug/history/:eventId/revert : apply the
// inverse of one event as a NEW event. `?force=1` overrides a conflict
// (the target changed since).
import { invalidateConfig } from "@/src/store/config-cache";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { revertEvent } from "@/src/store/revert";
import { checkAdminAuth } from "../../../../../_lib/admin-auth";
import { actorFromRequest, requireStoreManaged } from "../../../../../_lib/project-mutations";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; eventId: string }> },
): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, eventId } = await ctx.params;
  const force = new URL(req.url).searchParams.get("force") === "1";

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const event = await store.getConfigEvent(slug, Number(eventId));
  if (!event) return Response.json({ error: "unknown event", eventId }, { status: 404 });

  const result = revertEvent(project, event, force);
  if (result.conflict) {
    return Response.json({ error: "conflict", detail: result.conflict, canForce: true }, { status: 409 });
  }

  await store.saveProject(result.project, {
    slug,
    actor: actorFromRequest(req),
    kind: "revert",
    targetId: event.targetId,
    before: { revertedEventId: event.id, revertedKind: event.kind },
    after: null,
  });
  invalidateConfig(slug);
  return Response.json({ reverted: event.id, kind: event.kind });
}
