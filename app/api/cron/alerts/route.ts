// Plan 21 — the cron sweep: evaluate every enabled alert, across every
// project, once per invocation. Not wired into vercel.json's `crons` yet
// (that's plan 24, reliability & operations) — until then, call this on
// whatever schedule you like (an external cron hitting this URL works fine).
// Gated by the same MIRAGE_ADMIN_TOKEN as every other write endpoint rather
// than inventing a second secret — a cron caller is just another admin.
import { sweepAlert } from "@/src/alerts/evaluate";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../_lib/admin-auth";

async function handleSweep(req: Request): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  const store = await getRuntimeStore();
  const alerts = await store.listAllEnabledAlerts();
  const now = new Date();
  const results = await Promise.all(alerts.map((alert) => sweepAlert(store, alert, now)));

  return Response.json({ evaluated: results.length, firing: results.filter((r) => r.firing).length, results });
}

export async function POST(req: Request): Promise<Response> {
  return handleSweep(req);
}

export async function GET(req: Request): Promise<Response> {
  return handleSweep(req);
}
