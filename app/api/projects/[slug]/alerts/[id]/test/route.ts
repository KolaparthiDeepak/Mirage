// Plan 21 — the Test button: deliver a synthetic notification right now,
// through the exact same notifyAlert() the cron sweep uses, without touching
// lastFiredAt/currentlyFiring — a test send must never look like a real
// firing/recovery to anything reading the alert's state.
import { notifyAlert } from "@/src/alerts/notify";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../../_lib/admin-auth";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;
  const store = await getRuntimeStore();
  const alert = await store.getAlert(slug, id);
  if (!alert) return Response.json({ error: "unknown alert", id }, { status: 404 });

  const result = await notifyAlert(alert, "test", "this is a test notification from Mirage");
  return Response.json({ delivered: result.ok, error: result.error }, { status: result.ok ? 200 : 502 });
}
