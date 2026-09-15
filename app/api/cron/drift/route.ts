// Plan 22 — the drift cron sweep: run a check for every project whose
// driftConfig is enabled and whose schedule isn't "manual" (a manual-only
// project is only ever checked from its own Check button). `schedule` is
// metadata, not enforced cadence here — same deferral the alert sweep (plan
// 21) makes: whoever calls this on a timer (an external cron today, plan
// 24's vercel.json crons later) controls how often "daily"/"weekly" actually
// run. Gated by the same MIRAGE_ADMIN_TOKEN as every other write route.
import { runDriftCheck } from "@/src/drift/run";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../_lib/admin-auth";

async function handleSweep(req: Request): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  const store = await getRuntimeStore();
  const summaries = await store.listProjects();
  const results: Array<{ slug: string; checked: number; skipped: number; findingsCount: number; errored: number }> = [];

  for (const summary of summaries) {
    const project = await store.getProject(summary.slug);
    if (!project?.drift?.enabled || project.drift.schedule === "manual") continue;
    const outcome = await runDriftCheck(store, project);
    results.push({ slug: project.slug, ...outcome });
  }

  return Response.json({ swept: results.length, results });
}

export async function POST(req: Request): Promise<Response> {
  return handleSweep(req);
}

export async function GET(req: Request): Promise<Response> {
  return handleSweep(req);
}
