// Plan 03: POST /api/projects/:slug/rules — create a rule. Appends at the end
// (position = current max + 1) unless the caller specifies one.
import { assertSafeUpstreamUrl, UpstreamError } from "@/src/proxy/ssrf";
import { invalidateConfig } from "@/src/store/config-cache";
import { getRuntimeStore } from "@/src/store/runtime-source";
import { checkAdminAuth } from "../../../_lib/admin-auth";
import { checkNoSecretVarsInResponse, detectShadowWarning, requireStoreManaged, validateRuleDefinition } from "../../../_lib/project-mutations";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;
  const { slug } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }

  const store = await getRuntimeStore();
  const project = await store.getProject(slug);
  if (!project) return Response.json({ error: "unknown project", slug }, { status: 404 });
  const managedError = requireStoreManaged(project);
  if (managedError) return managedError;

  const validated = validateRuleDefinition(body);
  if ("error" in validated) return validated.error;
  const rule = validated.rule;

  // Plan 12: a callback URL is the same SSRF surface as plan 07 — gate it
  // here, at save, with the identical guard.
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

  if (project.rules.some((r) => r.ruleId === rule.id)) {
    return Response.json({ error: `rule id "${rule.id}" already exists in this project` }, { status: 409 });
  }

  const position = project.rules.length > 0 ? Math.max(...project.rules.map((r) => r.position)) + 1 : 0;
  const rules = [...project.rules, { ruleId: rule.id, position, definition: rule }];
  await store.saveProject({ ...project, rules });
  invalidateConfig(slug);

  const warning = detectShadowWarning(rules, rule.id);
  return Response.json({ rule, warning }, { status: 201 });
}
