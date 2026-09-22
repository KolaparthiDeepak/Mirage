// Plan 10 — the state layer. resolve() stays pure and synchronous; this is
// the only place that reads a counter and picks a variant. A rule with a
// singular `response` never reaches here (resolve() leaves route.responses
// undefined) and pays nothing.
import { buildResponse } from "../engine/resolve";
import type { ResolveResult, ResponseVariants } from "../engine/types";
import type { Store } from "../store/types";

const DEFAULT_SESSION_HEADER = "x-mirage-session";

export function sessionKey(headers: Record<string, string>, variants: ResponseVariants): string {
  const h = (variants.sessionHeader ?? DEFAULT_SESSION_HEADER).toLowerCase();
  return headers[h]?.trim() || "default";
}

/** djb2 — small, stable, no deps. Only used for the weighted strategy, where
 *  the requirement is "deterministic per (session, counter)", not crypto. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function whenPasses(c: { gte?: number; lt?: number; eq?: number }, n: number): boolean {
  return (c.gte == null || n >= c.gte) && (c.lt == null || n < c.lt) && (c.eq == null || n === c.eq);
}

/** callIndex is 0-based: 0 on the first call to this (rule, session). */
export function pickVariantIndex(variants: ResponseVariants, callIndex: number, session: string): number {
  const v = variants.variants;
  switch (variants.strategy) {
    case "sequence":
      if (callIndex < v.length) return callIndex;
      return variants.repeatLast ? v.length - 1 : callIndex % v.length;
    case "conditional": {
      const i = v.findIndex((variant) => variant.when && whenPasses(variant.when.callCount, callIndex));
      return i === -1 ? v.length - 1 : i;
    }
    case "weighted": {
      const total = v.reduce((s, x) => s + (x.weight ?? 0), 0);
      if (total <= 0) return 0;
      let r = hash(`${session}:${callIndex}`) % total;
      for (let i = 0; i < v.length; i++) {
        r -= v[i]!.weight ?? 0;
        if (r < 0) return i;
      }
      return v.length - 1;
    }
  }
}

export interface StateOutcome {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  variantIndex: number;
  counter: number;
  session: string;
  warnings: string[];
}

/** Returns null when the rule is not stateful, or when the counter store was
 *  unavailable — in both cases the caller serves resolve()'s default
 *  (variant[0]), never a 500 (plan 10 test: "counter store unavailable →
 *  falls back to the first variant and logs"). */
export async function applyState(
  store: Store,
  slug: string,
  result: ResolveResult,
): Promise<StateOutcome | null> {
  const route = result.matchedRoute;
  const ctx = result.templateContext;
  if (!route?.responses || !ctx || !result.matchedRuleId) return null;

  const variants = route.responses;
  const session = sessionKey(ctx.header, variants);

  let counter: number;
  try {
    counter = await store.bumpCounter(slug, result.matchedRuleId, session);
  } catch (e) {
    console.error(`[state] counter unavailable for "${slug}/${result.matchedRuleId}": ${(e as Error).message}`);
    return null;
  }

  const index = pickVariantIndex(variants, counter - 1, session);
  const warnings: string[] = [];
  const built = buildResponse(variants.variants[index]!, ctx, warnings);
  return { ...built, variantIndex: index, counter, session, warnings };
}
