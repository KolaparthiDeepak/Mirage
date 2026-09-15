// Plan 22 — "Accept upstream": overwrite the rule's response with what the
// last check actually observed, as a normal, revertible config change (plan
// 15) — never a special-cased write path.
import { getRuntimeStore } from "@/src/store/runtime-source";
import { invalidateConfig } from "@/src/store/config-cache";
import { SPEC_REPORT_ID } from "@/src/drift/run";
import { checkAdminAuth } from "../../../../../_lib/admin-auth";
import { actorFromRequest, requireStoreManaged } from "../../../../../_lib/project-mutations";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;
  if (id === SPEC_REPORT_ID) {
    return Response.json({ error: "spec drift has no single response to accept — update the rule(s) it affects directly" }, { status: 400 });
  }

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const report = await store.getDriftReport(slug, id);
  if (!report) return Response.json({ error: "unknown drift report", id }, { status: 404 });
  if (!report.observedResponse) {
    return Response.json({ error: "this report has no observed response to accept (it's a could-not-check error)" }, { status: 400 });
  }

  const existing = project.rules.find((r) => r.ruleId === report.ruleId);
  if (!existing) return Response.json({ error: "the rule this report is for no longer exists", ruleId: report.ruleId }, { status: 404 });
  if (existing.definition.responses) {
    return Response.json({ error: "cannot accept upstream for a rule with multiple response variants — edit it directly" }, { status: 400 });
  }

  const updated = {
    ...existing.definition,
    response: { status: report.observedResponse.status, body: report.observedResponse.body },
  };
  const rules = project.rules.map((r) => (r.ruleId === report.ruleId ? { ...r, definition: updated } : r));
  await store.saveProject(
    { ...project, rules },
    { slug, actor: actorFromRequest(req), kind: "rule.update", targetId: report.ruleId, before: existing.definition, after: updated },
  );
  invalidateConfig(slug);
  await store.deleteDriftReport(slug, id);

  return Response.json({ rule: updated });
}
