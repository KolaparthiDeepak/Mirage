import type { ProjectVariable } from "./types";

// Plan 17 — resolve a project's variables to a flat map for one request's
// environment. `overrides[env]` beats the base `value`. Secrets are excluded
// here: a secret in a mock response body would be exfiltrated by anyone
// calling the public URL (the save-time check is the primary guard; this is
// defence in depth).
export function resolveVars(
  variables: ProjectVariable[] | undefined,
  environment: string | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of variables ?? []) {
    if (v.secret) continue;
    out[v.key] = environment != null && v.overrides && environment in v.overrides ? v.overrides[environment] : v.value;
  }
  return out;
}

/** The `{{vars.*}}` keys referenced anywhere in a value tree — for save-time
 *  validation that a secret isn't used in a response body. */
export function collectVarRefs(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    for (const m of value.matchAll(/\{\{\s*vars\.([A-Za-z0-9_-]+)\s*\}\}/g)) into.add(m[1]!);
  } else if (Array.isArray(value)) {
    for (const v of value) collectVarRefs(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectVarRefs(v, into);
  }
  return into;
}
