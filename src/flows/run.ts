// Plan 16 — execute a flow. Each step goes through the real resolve() (plan
// 01) + applyState (plan 10), so a flow sees exactly what a real caller would:
// the same rule matching, the same stateful sequences. Faults (plan 11),
// upstream (plan 07) and callbacks (plan 12) are the mock ROUTE's concerns,
// not the engine's — a flow exercises the engine directly, not an HTTP
// round-trip through the route, so those three don't apply inside a run.
import { asString, resolveJsonPath } from "../engine/match";
import { resolve } from "../engine/resolve";
import type { ParsedRequest, ProjectConfig } from "../engine/types";
import { applyState } from "../state/apply";
import type { Store } from "../store/types";
import type { Flow, FlowAssertion, FlowStep } from "./schema";

const MAX_RUN_MS = 60_000;

export interface AssertionResult {
  description: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
}

export interface StepResult {
  name: string;
  method: string;
  path: string;
  status: number;
  matchedRuleId: string | null;
  durationMs: number;
  assertions: AssertionResult[];
  passed: boolean;
  error?: string;
}

export interface FlowRunOutcome {
  status: "passed" | "failed" | "error";
  steps: StepResult[];
}

/** `{{vars.name}}` substitution into a step's path/headers/body. A value that
 *  is exactly one token keeps its native type (so a captured number stays a
 *  number in a later step's body); embedded in a longer string, it's stringified. */
function substitute(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const lone = /^\{\{\s*vars\.([A-Za-z0-9_-]+)\s*\}\}$/.exec(value);
    if (lone) return lone[1]! in vars ? vars[lone[1]!] : value;
    return value.replace(/\{\{\s*vars\.([A-Za-z0-9_-]+)\s*\}\}/g, (whole, key: string) => {
      if (!(key in vars)) return whole;
      const v = vars[key];
      return typeof v === "string" ? v : JSON.stringify(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]));
  }
  return value;
}

function evalAssertion(
  a: FlowAssertion,
  response: { status: number; matchedRuleId: string | null; body: unknown },
): AssertionResult {
  if ("status" in a) {
    return { description: `status equals ${a.status}`, passed: response.status === a.status, expected: a.status, actual: response.status };
  }
  if ("matchedRule" in a) {
    return {
      description: `matchedRule equals "${a.matchedRule}"`,
      passed: response.matchedRuleId === a.matchedRule,
      expected: a.matchedRule,
      actual: response.matchedRuleId,
    };
  }
  const actualRaw = resolveJsonPath(response.body, a.jsonPath);
  const actual = asString(actualRaw);
  if ("exists" in a) {
    const passed = a.exists ? actual !== undefined : actual === undefined;
    return { description: `${a.jsonPath} ${a.exists ? "exists" : "does not exist"}`, passed, actual: actualRaw };
  }
  if ("equals" in a) {
    const expected = asString(a.equals);
    return { description: `${a.jsonPath} equals ${JSON.stringify(a.equals)}`, passed: actual === expected, expected: a.equals, actual: actualRaw };
  }
  if ("contains" in a) {
    const needle = asString(a.contains) ?? "";
    return { description: `${a.jsonPath} contains ${JSON.stringify(a.contains)}`, passed: (actual ?? "").includes(needle), expected: a.contains, actual: actualRaw };
  }
  // "regex" is the only remaining key the schema allows.
  let passed = false;
  try {
    passed = new RegExp(a.regex!).test(actual ?? "");
  } catch {
    passed = false;
  }
  return { description: `${a.jsonPath} matches /${a.regex}/`, passed, expected: a.regex, actual: actualRaw };
}

function buildRequest(step: FlowStep, vars: Record<string, unknown>): ParsedRequest {
  const rawPath = substitute(step.request.path, vars) as string;
  const [path, queryString] = rawPath.split("?");
  const query: Record<string, string> = {};
  if (queryString) new URLSearchParams(queryString).forEach((v, k) => (query[k] = v));

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(step.request.headers ?? {})) headers[k.toLowerCase()] = String(substitute(v, vars));

  const body = step.request.body === undefined ? undefined : substitute(step.request.body, vars);
  const rawBody = body === undefined ? "" : JSON.stringify(body);

  return { method: step.request.method, path: path || "/", headers, query, body, rawBody };
}

export async function runFlow(
  project: ProjectConfig,
  flow: Flow,
  store: Store,
  slug: string,
  runId: string,
): Promise<FlowRunOutcome> {
  const startedAt = Date.now();
  const vars: Record<string, unknown> = {};
  const steps: StepResult[] = [];
  let overallOk = true;

  for (const step of flow.steps) {
    if (Date.now() - startedAt > MAX_RUN_MS) {
      steps.push({ name: step.name, method: step.request.method, path: step.request.path, status: 0, matchedRuleId: null, durationMs: 0, assertions: [], passed: false, error: "run exceeded the 60s cap" });
      return { status: "error", steps };
    }

    const stepStart = Date.now();
    const req = buildRequest(step, vars);
    // Each step's session defaults to the run id, unless the step names its
    // own — so a flow using sequences (plan 10) never collides with anyone
    // else's testing, and repeated runs of the same flow don't share state.
    if (!req.headers["x-mirage-session"]) req.headers["x-mirage-session"] = runId;

    let status: number;
    let body: unknown;
    let matchedRuleId: string | null;
    let error: string | undefined;
    try {
      const result = resolve(req, project);
      status = result.status;
      body = result.body;
      matchedRuleId = result.matchedRuleId;
      if (result.matchedRuleId !== null && result.matchedRoute?.responses) {
        const state = await applyState(store, slug, result);
        if (state) {
          status = state.status;
          body = state.body;
        }
      }
    } catch (e) {
      status = 0;
      body = undefined;
      matchedRuleId = null;
      error = (e as Error).message;
    }

    const durationMs = Date.now() - stepStart;

    if (error) {
      steps.push({ name: step.name, method: req.method, path: req.path, status, matchedRuleId, durationMs, assertions: [], passed: false, error });
      overallOk = false;
      if (!step.continueOnFailure) return { status: "error", steps };
      continue;
    }

    const assertions = step.assert.map((a) => evalAssertion(a, { status, matchedRuleId, body }));
    const stepPassed = assertions.every((a) => a.passed);
    if (!stepPassed) overallOk = false;

    for (const c of step.capture) vars[c.name] = resolveJsonPath(body, c.from);

    steps.push({ name: step.name, method: req.method, path: req.path, status, matchedRuleId, durationMs, assertions, passed: stepPassed });

    if (!stepPassed && !step.continueOnFailure) return { status: "failed", steps };
  }

  return { status: overallOk ? "passed" : "failed", steps };
}
