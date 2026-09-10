// Plan 03: shared validation and guard logic for every write endpoint under
// app/api/projects/. Deliberately outside app/m/ so the mock hot path never
// shares code with the write path (beyond the pure engine/store primitives
// both already depend on).
import { assertResponseValid, toRoute } from "@/src/compile/compile";
import { ruleSchema, type Rule } from "@/src/compile/schema";
import { methodSubsumes, segmentsSubsume } from "@/src/engine/match";
import { TemplateError } from "@/src/engine/template";
import type { StoredProject, StoredRule } from "@/src/store/types";

export function requireStoreManaged(project: StoredProject): Response | null {
  if (project.source === "repo") {
    return Response.json(
      { error: `project "${project.slug}" is repo-managed — edit it in mocks/${project.slug}/ and redeploy` },
      { status: 409 },
    );
  }
  return null;
}

/** Optimistic concurrency: reject a save whose `ifVersion` no longer matches
 *  what is actually stored (plan 03: "config_version compare-and-set on save;
 *  a conflict returns 409 with a diff" — the diff itself is a UI concern; this
 *  is the check that makes 409 possible at all). */
export function checkVersion(project: StoredProject, ifVersion: number | undefined): Response | null {
  if (ifVersion !== undefined && project.configVersion !== ifVersion) {
    return Response.json(
      { error: "this project changed since you loaded it", currentVersion: project.configVersion },
      { status: 409 },
    );
  }
  return null;
}

/** Validates a rule definition with the exact schema and header/template
 *  checks the compiler enforces at build time — plan 03: "Save is refused...
 *  the server re-validates and is the authority." */
export function validateRuleDefinition(input: unknown): { rule: Rule } | { error: Response } {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { error: Response.json({ error: `${issue.path.join(".") || "rule"}: ${issue.message}` }, { status: 400 }) };
  }
  if (parsed.data.request.path.startsWith("/__")) {
    return { error: Response.json({ error: 'rule path may not start with "/__" — reserved' }, { status: 400 }) };
  }
  try {
    assertResponseValid(parsed.data.response);
  } catch (e) {
    if (e instanceof TemplateError) return { error: Response.json({ error: e.message }, { status: 400 }) };
    throw e;
  }
  return { rule: parsed.data };
}

/** B10's shadow check, at save time rather than only at build time (plan 03:
 *  "surfaces ... as a warning with a Move-up action — not a block"). Reuses
 *  the exact subsumption logic the compiler's dead-rule warning uses. */
export function detectShadowWarning(rules: StoredRule[], targetRuleId: string): string | null {
  const ordered = [...rules].sort((a, b) => a.position - b.position);
  const routes = ordered.map((r) => toRoute(r.definition));
  const targetIdx = routes.findIndex((r) => r.id === targetRuleId);
  if (targetIdx <= 0) return null;
  const target = routes[targetIdx]!;

  for (let i = 0; i < targetIdx; i++) {
    const earlier = routes[i]!;
    const earlierRule = ordered[i]!.definition;
    if (
      (!earlierRule.request.match || earlierRule.request.match.length === 0) &&
      methodSubsumes(earlier.method, target.method) &&
      segmentsSubsume(earlier.segments, target.segments)
    ) {
      return `rule "${target.id}" is unreachable — rule "${earlier.id}" above already matches everything it matches`;
    }
  }
  return null;
}
