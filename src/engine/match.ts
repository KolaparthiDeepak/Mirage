import type { MatchCondition, ParsedRequest, Segment } from "./types";

export function compileSegments(path: string): Segment[] {
  const parts = path.split("/").filter((p) => p.length > 0);
  return parts.map((p): Segment => {
    if (p === "**") return { kind: "catchall" };
    if (p === "*") return { kind: "wildcard" };
    if (p.startsWith(":")) return { kind: "param", name: p.slice(1) };
    return { kind: "literal", value: p };
  });
}

export function matchPath(
  segments: Segment[],
  requestPath: string,
): { matched: boolean; params: Record<string, string> } {
  const reqParts = requestPath.split("/").filter((p) => p.length > 0);
  const params: Record<string, string> = {};

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.kind === "catchall") {
      return { matched: i === segments.length - 1, params };
    }
    const part = reqParts[i];
    if (part === undefined) return { matched: false, params };
    if (seg.kind === "literal") {
      if (seg.value !== part) return { matched: false, params };
    } else if (seg.kind === "param") {
      params[seg.name] = part;
    }
    // wildcard: any single part, no capture
  }
  return { matched: reqParts.length === segments.length, params };
}

export function methodMatches(routeMethod: string, requestMethod: string): boolean {
  return routeMethod === "*" || routeMethod.toUpperCase() === requestMethod.toUpperCase();
}

/** True when `earlier` matches every request `later` can match, so `later` is dead
 *  under first-match-wins. A literal subsumes only an identical literal; param and
 *  wildcard subsume any single segment; catchall subsumes the rest of the path.
 *  Shared by the compiler's dead-rule warning (B10) and the match trace's
 *  "unreachable rule below" hint (plan 06) — one definition of "shadows". */
export function segmentsSubsume(earlier: Segment[], later: Segment[]): boolean {
  for (let i = 0; i < earlier.length; i++) {
    const e = earlier[i]!;
    if (e.kind === "catchall") return true;
    const l = later[i];
    if (l === undefined) return false;
    if (e.kind === "literal") {
      if (l.kind !== "literal" || l.value !== e.value) return false;
    } else if (l.kind === "catchall") {
      // A single-segment earlier pattern cannot cover an unbounded tail.
      return false;
    }
    // param / wildcard cover any single later segment
  }
  return later.length === earlier.length;
}

export function methodSubsumes(earlier: string, later: string): boolean {
  return earlier === "*" || earlier === later;
}

/** Property names that would read off the prototype chain rather than the request. */
export const FORBIDDEN_PATH_TOKENS = new Set(["__proto__", "constructor", "prototype"]);

/** "$.a.b[0]" -> ["a", "b", "0"]. Shared with the compiler so both agree on shape. */
export function jsonPathTokens(path: string): string[] {
  const trimmed = path.startsWith("$.") ? path.slice(2) : path.startsWith("$") ? path.slice(1) : path;
  return trimmed
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((t) => t.length > 0);
}

export function resolveJsonPath(body: unknown, path: string): unknown {
  if (body == null) return undefined;
  let cur: unknown = body;
  for (const tok of jsonPathTokens(path)) {
    // Own properties only: without this, `$.__proto__` and `$.constructor`
    // resolve off the prototype chain and match on data the request never sent.
    if (cur == null || typeof cur !== "object" || !Object.hasOwn(cur, tok)) return undefined;
    cur = (cur as Record<string, unknown>)[tok];
  }
  return cur;
}

// Exported for src/flows/run.ts (plan 16) — assertions reuse this exact
// string coercion so "equals" means the same thing whether it's matching a
// request or asserting on a response.
export function asString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

// Patterns come from repo-authored rules, so the set is small and bounded; compiling
// per request (as this did) recompiled the same source on every call.
const regexCache = new Map<string, RegExp>();

function compiledRegex(source: string): RegExp {
  let re = regexCache.get(source);
  if (!re) {
    re = new RegExp(source);
    regexCache.set(source, re);
  }
  return re;
}

function applyOperator(cond: MatchCondition, actual: string | undefined): boolean {
  if ("exists" in cond) return cond.exists ? actual !== undefined : actual === undefined;
  if (actual === undefined) return false;
  if ("equals" in cond) return actual === cond.equals;
  if ("notEquals" in cond) return actual !== cond.notEquals;
  if ("contains" in cond) return actual.includes(cond.contains);
  if ("regex" in cond) return compiledRegex(cond.regex).test(actual);
  return false;
}

export function evalCondition(cond: MatchCondition, req: ParsedRequest): boolean {
  let actual: string | undefined;
  if ("jsonPath" in cond) actual = asString(resolveJsonPath(req.body, cond.jsonPath));
  else if ("header" in cond) actual = req.headers[cond.header.toLowerCase()];
  else actual = req.query[cond.query];
  return applyOperator(cond, actual);
}

export function allMatch(conds: MatchCondition[] | undefined, req: ParsedRequest): boolean {
  if (!conds || conds.length === 0) return true;
  return conds.every((c) => evalCondition(c, req));
}
