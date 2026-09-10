// Plan 15 — GET /api/projects/:slug/history : reverse-chronological config
// events. `?targetId=` scopes to one rule (the per-rule history in the editor);
// `?before=` pages.
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../_lib/admin-auth";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;
  const url = new URL(req.url);

  const store = await getRuntimeStore();
  const events = await store.listConfigEvents(slug, {
    limit: Math.min(Number(url.searchParams.get("limit")) || 100, 500),
    before: url.searchParams.get("before") ?? undefined,
    targetId: url.searchParams.get("targetId") ?? undefined,
  });
  return Response.json({ events });
}
