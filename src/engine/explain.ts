// Plan 06: resolve() already walks the rules in order and already knows
// precisely why each one failed — it just discards that at the `continue`.
// explain() re-walks the same routes to recover that reasoning, computed on
// demand (never on the hot path — resolve() is untouched, still pure and
// synchronous). The two must agree on the winner; that is closed by a
// property test, not by sharing control flow, because the *reasoning* this
// file adds (hints, per-condition detail) has no place inside resolve()'s
// tight loop.
import { evalCondition, matchPath, methodMatches, methodSubsumes, resolveJsonPath, segmentsSubsume } from "./match";
import { stripBasePath } from "./resolve";
import type { MatchCondition, ParsedRequest, ProjectConfig, Route } from "./types";

export type CheckStatus = "pass" | "fail" | "skip";

export interface ConditionCheck {
  index: number;
  condition: MatchCondition;
  /** The value the condition actually compared against, stringified the same
   *  way match.ts's operators do — undefined when the target was absent. */
  actual: string | undefined;
  passed: boolean;
  hint?: string;
}

export interface RuleTrace {
  ruleId: string;
  method: CheckStatus;
  path: CheckStatus;
  /** "skip" when the rule has no match block — nothing to check, so it can't
   *  be what disqualified it. */
  match: CheckStatus;
  /** Every condition, not just the first failure — plan 06's example only
   *  shows the first, but a caller (the UI) can choose how much to render. */
  conditions?: ConditionCheck[];
  /** A note attached to *this* rule specifically — e.g. "paths are
   *  case-sensitive" on a path check, or "rule X below can never be reached"
   *  on the winner. */
  hint?: string;
}

export interface ExplainResult {
  outsideBasePath: boolean;
  /** Present only when outsideBasePath is true. */
  basePathHint?: string;
  /** Evaluated routes, in the order resolve() would see them, stopping at
   *  (and including) the winner. Empty when outsideBasePath is true — resolve()
   *  never reaches the loop in that case either. */
  traces: RuleTrace[];
  winnerRuleId: string | null;
  /** Hints about the request itself, not any one rule — e.g. an unparsable body. */
  requestHints: string[];
}

function stringifyActual(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Mirrors match.ts's own target resolution (jsonPath / header / query) so the
 *  trace can show the same "actual" value evalCondition compared against. */
function actualFor(cond: MatchCondition, req: ParsedRequest): string | undefined {
  if ("jsonPath" in cond) return stringifyActual(resolveJsonPath(req.body, cond.jsonPath));
  if ("header" in cond) return req.headers[cond.header.toLowerCase()];
  return req.query[cond.query];
}

function conditionHint(cond: MatchCondition, actual: string | undefined): string | undefined {
  const failsClosed = "notEquals" in cond || "contains" in cond || "regex" in cond;
  if (failsClosed && actual === undefined) {
    return 'fails closed when absent — use "exists: false" to assert a field is missing';
  }
  return undefined;
}

function checkConditions(route: Route, req: ParsedRequest): { status: CheckStatus; conditions?: ConditionCheck[] } {
  if (!route.match || route.match.length === 0) return { status: "skip" };
  const conditions = route.match.map((condition, index): ConditionCheck => {
    const actual = actualFor(condition, req);
    const passed = evalCondition(condition, req);
    return { index, condition, actual, passed, hint: passed ? undefined : conditionHint(condition, actual) };
  });
  return { status: conditions.every((c) => c.passed) ? "pass" : "fail", conditions };
}

/** Case differs from the incoming path but the segments otherwise match — the
 *  B6 trap: path matching is case-sensitive, and a mismatch here reads
 *  identically to any other path mismatch unless called out. */
function caseInsensitiveMatch(route: Route, path: string): boolean {
  const lowerParts = path.toLowerCase().split("/").filter((p) => p.length > 0);
  const pm = matchPath(
    route.segments.map((s) => (s.kind === "literal" ? { ...s, value: s.value.toLowerCase() } : s)),
    lowerParts.join("/"),
  );
  return pm.matched;
}

/** Path check passed and the raw request path differs from the route's own
 *  path string only by a trailing slash — a reassurance, not a fix: trailing
 *  slashes are already ignored (B6), so that is never the actual reason a
 *  request did or didn't match. */
function trailingSlashNote(route: Route, rawPath: string): string | undefined {
  const stripTrailing = (s: string) => (s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s);
  if (rawPath !== route.path && stripTrailing(rawPath) === stripTrailing(route.path)) {
    return "trailing slashes are ignored — that is not what distinguishes this path";
  }
  return undefined;
}

/** The winner shadows a later, more specific rule for the same request shape
 *  (B10, at request time rather than build time): if the winner has no match
 *  conditions and a rule below it could only ever be reached by a request
 *  this one already catches, that rule is dead — worth saying at the moment
 *  someone is confused about which rule actually answered. */
function shadowedBelowHint(winner: Route, allRoutes: Route[]): string | undefined {
  if (winner.match && winner.match.length > 0) return undefined;
  const winnerIndex = allRoutes.indexOf(winner);
  const shadowed = allRoutes
    .slice(winnerIndex + 1)
    .find((r) => methodSubsumes(winner.method, r.method) && segmentsSubsume(winner.segments, r.segments));
  return shadowed
    ? `rule "${shadowed.id}" below can never be reached — this rule has no conditions and matches everything it does`
    : undefined;
}

export function explain(req: ParsedRequest, project: ProjectConfig): ExplainResult {
  const requestHints: string[] = [];
  if (req.rawBody.length > 0 && req.body === undefined) {
    requestHints.push("body did not parse as JSON — every jsonPath condition fails against it");
  }

  const path = stripBasePath(req.path, project.basePath);
  if (path === null) {
    return {
      outsideBasePath: true,
      basePathHint: `request path "${req.path}" does not start with this project's basePath ("${project.basePath}") — it can never match any rule`,
      traces: [],
      winnerRuleId: null,
      requestHints,
    };
  }

  const traces: RuleTrace[] = [];
  let winnerRuleId: string | null = null;

  for (const route of project.routes) {
    const methodStatus: CheckStatus = methodMatches(route.method, req.method) ? "pass" : "fail";
    const pm = matchPath(route.segments, path);
    const pathStatus: CheckStatus = pm.matched ? "pass" : "fail";
    let pathHint: string | undefined;
    if (!pm.matched && caseInsensitiveMatch(route, path)) {
      pathHint = "paths are case-sensitive — this rule's path differs from the request only in case";
    } else if (pm.matched) {
      pathHint = trailingSlashNote(route, path);
    }

    // Match conditions only matter once method + path both pass — mirrors
    // resolve()'s short-circuit so the trace never claims a condition failed
    // when resolve() never would have evaluated it.
    const { status: matchStatus, conditions } =
      methodStatus === "pass" && pathStatus === "pass" ? checkConditions(route, req) : { status: "skip" as const, conditions: undefined };

    const isWinner = methodStatus === "pass" && pathStatus === "pass" && matchStatus !== "fail";
    const trace: RuleTrace = {
      ruleId: route.id,
      method: methodStatus,
      path: pathStatus,
      match: matchStatus,
      conditions,
      hint: pathHint,
    };

    if (isWinner) {
      trace.hint = trace.hint ?? shadowedBelowHint(route, project.routes);
      traces.push(trace);
      winnerRuleId = route.id;
      break; // first-match-wins — resolve() stops here too.
    }
    traces.push(trace);
  }

  return { outsideBasePath: false, traces, winnerRuleId, requestHints };
}
