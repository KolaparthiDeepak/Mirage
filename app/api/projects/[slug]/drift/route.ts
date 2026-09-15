// Plan 22 — GET the project's current drift reports.
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../_lib/admin-auth";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;
  const store = await getRuntimeStore();
  const reports = await store.listDriftReports(slug);
  return Response.json({ reports });
}
