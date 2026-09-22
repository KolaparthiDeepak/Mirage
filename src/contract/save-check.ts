// Plan 13.1 — validate a rule's response body against the project's OpenAPI
// spec at save time. Warnings by default; the caller blocks only when
// `contract.enforce` is on.
import type { Rule } from "../compile/schema";
import { operationSchemas } from "./operation";
import { validateAgainstSchema } from "./validate";

/** Paths (`$.a.b`) whose value is a string containing a `{{template}}` — a
 *  violation there is a false positive (the real value is filled at request
 *  time), so it is filtered out. */
function templatedPaths(value: unknown, prefix = "$", into = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (/\{\{[^}]+\}\}/.test(value)) into.add(prefix);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => templatedPaths(v, `${prefix}.${i}`, into));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) templatedPaths(v, `${prefix}.${k}`, into);
  }
  return into;
}

export async function checkRuleAgainstSpec(openApiDoc: unknown, rule: Rule): Promise<string[]> {
  if (!openApiDoc) return [];
  const responses = rule.response ? [rule.response] : (rule.responses?.variants ?? []);
  const warnings: string[] = [];
  for (const resp of responses) {
    if (resp.body === undefined) continue;
    const op = operationSchemas(openApiDoc, rule.request.method, rule.request.path, resp.status);
    if (!op?.responseSchema) continue;
    const skip = templatedPaths(resp.body);
    const violations = await validateAgainstSchema(
      op.responseSchema,
      resp.body,
      `${rule.request.method} ${op.oaPath} res ${resp.status}`,
    );
    for (const v of violations) {
      if (skip.has(v.path)) continue;
      warnings.push(`response for ${rule.request.method} ${op.oaPath} (${resp.status}): ${v.path}: ${v.message}`);
    }
  }
  return warnings;
}
