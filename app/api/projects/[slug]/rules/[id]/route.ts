// Plan 03: PATCH /api/projects/:slug/rules/:id (full-definition replace,
// position kept), DELETE /api/projects/:slug/rules/:id.
import { checkRuleAgainstSpec } from "@/src/contract/save-check";
import { assertSafeUpstreamUrl, UpstreamError } from "@/src/proxy/ssrf";
import { invalidateConfig } from "@/src/store/config-cache";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../../_lib/admin-auth";
import { actorFromRequest, checkNoSecretVarsInResponse, checkVersion, detectShadowWarning, requireStoreManaged, validateRuleDefinition } from "../../../../_lib/project-mutations";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }
  const ifVersion = (body as { ifVersion?: number }).ifVersion;

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;
  const versionError = checkVersion(project, ifVersion);
  if (versionError) return versionError;

  const existing = project.rules.find((r) => r.ruleId === id);
  if (!existing) return Response.json({ error: "unknown rule", id }, { status: 404 });

  const validated = validateRuleDefinition(body);
  if ("error" in validated) return validated.error;
  const rule = validated.rule;
  if (rule.id !== id) {
    return Response.json({ error: "a rule's id cannot be changed via edit — delete and recreate it instead" }, { status: 400 });
  }
  if (rule.callback) {
    try {
      await assertSafeUpstreamUrl(rule.callback.url);
    } catch (e) {
      if (e instanceof UpstreamError) return Response.json({ error: `callback.url: ${e.message}` }, { status: 400 });
      throw e;
    }
  }
  const secretError = checkNoSecretVarsInResponse(rule, project);
  if (secretError) return secretError;

  const contractWarnings = await checkRuleAgainstSpec(project.openApiDoc, rule);
  if (contractWarnings.length > 0 && project.contract?.enforce) {
    return Response.json({ error: "rule contradicts the OpenAPI spec", contractWarnings }, { status: 400 });
  }

  if (project.rules.some((r) => r.ruleId === rule.id && r !== existing)) {
    return Response.json({ error: `rule id "${rule.id}" collides with another rule` }, { status: 409 });
  }

  const rules = project.rules.map((r) => (r.ruleId === id ? { ...r, definition: rule } : r));
  await store.saveProject(
    { ...project, rules },
    { slug, actor: actorFromRequest(req), kind: "rule.update", targetId: id, before: existing.definition, after: rule },
  );
  invalidateConfig(slug);

  const warning = detectShadowWarning(rules, id);
  return Response.json({ rule, warning, contractWarnings });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug, id } = await ctx.params;

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  if (!project.rules.some((r) => r.ruleId === id)) {
    return Response.json({ error: "unknown rule", id }, { status: 404 });
  }
  const removed = project.rules.find((r) => r.ruleId === id)!;
  const rules = project.rules.filter((r) => r.ruleId !== id);
  await store.saveProject(
    { ...project, rules },
    { slug, actor: actorFromRequest(req), kind: "rule.delete", targetId: id, before: { ...removed.definition, position: removed.position }, after: null },
  );
  invalidateConfig(slug);
  return new Response(null, { status: 204 });
}
