// Plan 22 — "Dismiss": suppress this report until its content actually
// changes (src/drift/run.ts reopens it automatically at that point).
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../../_lib/admin-auth";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;
  const store = await getRuntimeStore();
  const report = await store.getDriftReport(slug, id);
  if (!report) return Response.json({ error: "unknown drift report", id }, { status: 404 });

  await store.saveDriftReport({ ...report, dismissed: true });
  return Response.json({ report: { ...report, dismissed: true } });
}
