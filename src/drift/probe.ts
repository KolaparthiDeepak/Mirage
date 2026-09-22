// Plan 22 — the drift probe: send one rule's synthesised example request to
// the real upstream and structurally compare the response with the mock.
// Reuses plan 07's SSRF guard, forwarder, target-URL builder and per-project
// rate limiter verbatim — a drift check is just another kind of upstream
// call, and "one implementation, N callers" already covers this exact shape
// (proxying, callbacks, alerts, and now this).
import { compareResponses } from "./compare";
import type { DriftFinding } from "./types";
import { buildTarget } from "../proxy/index";
import { forwardToUpstream } from "../proxy/forward";
import { allowUpstreamCall } from "../proxy/rate-limit";
import { assertSafeUpstreamUrl, UpstreamError } from "../proxy/ssrf";
import { jsonMediaType, operationFor, requestExample, requiredProps, schemaProps, type OaDoc } from "../viewer/model";
import { synthesizeRequest } from "../viewer/curl";
import type { DriftConfig, Route, UpstreamConfig } from "../engine/types";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

/** ":id" -> "1", "*" / "**" -> "probe" — the exact value never matters (no
 *  match condition in this engine constrains a path segment), only that the
 *  probe hits a real, resolvable route. */
function resolveConcretePath(route: Route): string {
  const parts = route.segments.map((seg) => {
    if (seg.kind === "literal") return seg.value;
    if (seg.kind === "param") return "1";
    return "probe";
  });
  return `/${parts.join("/")}`;
}

export type ProbeOutcome =
  | { findings: DriftFinding[]; observedResponse: { status: number; body: unknown } }
  | { error: string }
  /** Not eligible to probe at all (wildcard method, unsafe method without
   *  acknowledgement) — distinct from `error`: this rule was never attempted,
   *  so it should never show up on the Drift page as "could not check". */
  | { skipped: string };

export interface ProbeInput {
  slug: string;
  basePath?: string;
  route: Route;
  upstream: UpstreamConfig;
  drift: DriftConfig;
  openApiDoc?: unknown;
}

/** Probes exactly one rule. Never throws — every failure mode (unsafe
 *  method, SSRF rejection, network error, non-JSON body, rate limit) comes
 *  back as `{ error }`, per the plan's own risk table: "report as could not
 *  check, never as drift." */
export async function probeRule(input: ProbeInput): Promise<ProbeOutcome> {
  const { route } = input;
  if (route.method === "*") return { skipped: "wildcard-method rules are not probed" };

  const method = route.method;
  if (!SAFE_METHODS.has(method)) {
    const allowed = input.drift.allowUnsafeMethods && route.drift?.acknowledgeUnsafeMethod === true;
    if (!allowed) return { skipped: `${method} is not a safe method — per-rule acknowledgement required to probe it` };
  }

  if (!allowUpstreamCall(input.slug)) return { error: "per-project upstream rate limit exceeded" };

  let base: URL;
  try {
    base = await assertSafeUpstreamUrl(input.upstream.url);
  } catch (e) {
    return { error: e instanceof UpstreamError ? e.message : "upstream URL failed validation" };
  }

  const doc = input.openApiDoc as OaDoc | undefined;
  const fullPath = (input.basePath ?? "") + route.path;
  const op = operationFor(doc, fullPath, method);
  const mt = jsonMediaType(op);

  const concretePath = resolveConcretePath(route);
  const draft = synthesizeRequest({
    method,
    runUrl: concretePath,
    match: route.match ?? [],
    requestExample: requestExample(mt),
    requestSchemaProps: schemaProps(mt),
    requiredProps: requiredProps(mt),
  });

  const subPath = (input.basePath ?? "") + draft.url;
  const target = buildTarget(base, subPath, "");
  const res = await forwardToUpstream({
    targetUrl: target,
    method,
    reqHeaders: { ...draft.headers, "x-mirage-drift-check": "1" },
    body: draft.body ?? null,
    forwardAuth: false,
    timeoutMs: input.upstream.timeoutMs,
  });

  if (res.error) return { error: `upstream ${res.error === "timeout" ? "timed out" : "request failed"}` };

  let upstreamBody: unknown = null;
  if (res.bodyText) {
    try {
      upstreamBody = JSON.parse(res.bodyText);
    } catch {
      return { error: "upstream response was not JSON — could not compare structurally" };
    }
  }

  const findings = compareResponses(
    { status: route.response.status, body: route.response.body },
    { status: res.status, body: upstreamBody },
    { ignorePaths: route.drift?.ignorePaths, compareCosmetic: input.drift.compareCosmetic },
  );
  return { findings, observedResponse: { status: res.status, body: upstreamBody } };
}
