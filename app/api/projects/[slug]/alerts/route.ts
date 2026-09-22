// Plan 21 — GET list / POST create one alert. A 10-per-project cap (risk
// table: "alerts become a second monitoring product" is guarded by keeping
// the count small, same shape as flows' 50-step cap) is enforced here, on
// create only — an update to an existing alert never trips it.
import { resolveBuiltinViewQuery } from "@/src/views/builtins";
import { alertSchema } from "@/src/views/schema";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../_lib/admin-auth";
import { requireStoreManaged } from "../../../_lib/project-mutations";

const MAX_ALERTS_PER_PROJECT = 10;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;
  const store = await getRuntimeStore();
  const alerts = await store.listAlerts(slug);
  return Response.json({ alerts });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const parsed = alertSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return Response.json({ error: `${issue.path.join(".") || "alert"}: ${issue.message}` }, { status: 400 });
  }

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const existing = await store.getAlert(slug, parsed.data.id);
  if (!existing) {
    const count = (await store.listAlerts(slug)).length;
    if (count >= MAX_ALERTS_PER_PROJECT) {
      return Response.json({ error: `project already has ${MAX_ALERTS_PER_PROJECT} alerts — delete one before adding another` }, { status: 409 });
    }
  }

  if (!resolveBuiltinViewQuery(parsed.data.view) && !(await store.getView(slug, parsed.data.view))) {
    return Response.json({ error: `unknown view "${parsed.data.view}"` }, { status: 400 });
  }

  const now = new Date().toISOString();
  await store.saveAlert({
    id: parsed.data.id,
    slug,
    name: parsed.data.name,
    view: parsed.data.view,
    condition: parsed.data.condition,
    notify: parsed.data.notify,
    cooldownMinutes: parsed.data.cooldownMinutes,
    enabled: parsed.data.enabled,
    lastFiredAt: existing?.lastFiredAt ?? null,
    lastRecoveredAt: existing?.lastRecoveredAt ?? null,
    lastError: existing?.lastError ?? null,
    currentlyFiring: existing?.currentlyFiring ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  const saved = await store.getAlert(slug, parsed.data.id);
  return Response.json({ alert: saved }, { status: existing ? 200 : 201 });
}
