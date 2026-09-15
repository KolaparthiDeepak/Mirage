// Plan 22 — spec drift: diff the upstream's live OpenAPI document against the
// project's stored one. Cheaper than probing every rule's response (one
// request instead of one per rule) and often catches a change earlier.
import { assertSafeUpstreamUrl, UpstreamError } from "../proxy/ssrf";
import { forwardToUpstream } from "../proxy/forward";
import type { DriftFinding } from "./types";

interface OaDoc {
  paths?: Record<string, Record<string, unknown>>;
}

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function operations(doc: OaDoc | undefined): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [path, ops] of Object.entries(doc?.paths ?? {})) {
    for (const method of METHODS) {
      if (ops?.[method] !== undefined) out.set(`${method.toUpperCase()} ${path}`, ops[method]);
    }
  }
  return out;
}

/** Strips prose fields that carry no behavioral meaning — flagging every
 *  reworded `summary` as "changed" would make this noisier than the response
 *  probe it exists to be cheaper than. */
function stripProse(op: unknown): unknown {
  if (typeof op !== "object" || op === null) return op;
  const { summary: _summary, description: _description, ...rest } = op as Record<string, unknown>;
  return rest;
}

export type SpecFetchOutcome = { doc: unknown } | { error: string };

/** Fetches the upstream's OpenAPI document. `specUrl` may be an absolute URL
 *  or a path resolved against the upstream's own origin. Never throws — the
 *  same "could not check, never as drift" contract as probe.ts. */
export async function fetchUpstreamSpec(upstreamUrl: string, specUrl: string, timeoutMs: number): Promise<SpecFetchOutcome> {
  let target: URL;
  try {
    const absolute = /^https?:\/\//i.test(specUrl) ? specUrl : new URL(specUrl, upstreamUrl).toString();
    target = await assertSafeUpstreamUrl(absolute);
  } catch (e) {
    return { error: e instanceof UpstreamError ? e.message : "spec URL failed validation" };
  }

  const res = await forwardToUpstream({
    targetUrl: target,
    method: "GET",
    reqHeaders: { "x-mirage-drift-check": "1" },
    body: null,
    forwardAuth: false,
    timeoutMs,
  });
  if (res.error) return { error: `spec fetch ${res.error === "timeout" ? "timed out" : "failed"}` };
  if (res.status >= 400) return { error: `spec endpoint responded ${res.status}` };
  if (!res.bodyText) return { error: "spec endpoint returned an empty body" };
  try {
    return { doc: JSON.parse(res.bodyText) };
  } catch {
    return { error: "spec endpoint did not return JSON" };
  }
}

/** Added/removed/changed operations, keyed by "METHOD /path". A removed
 *  operation is breaking (a mock rule may depend on it); an added one is
 *  additive; a changed one (anything but summary/description differs) is
 *  reported as breaking — conservative, since the nature of the change is
 *  unknown until someone looks. */
export function compareSpecs(stored: unknown, upstream: unknown): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const storedOps = operations(stored as OaDoc | undefined);
  const upstreamOps = operations(upstream as OaDoc | undefined);

  for (const [key, op] of storedOps) {
    const upstreamOp = upstreamOps.get(key);
    if (upstreamOp === undefined) {
      findings.push({ severity: "breaking", path: key, kind: "operation-removed", detail: `"${key}" is no longer in the upstream spec` });
      continue;
    }
    if (JSON.stringify(stripProse(op)) !== JSON.stringify(stripProse(upstreamOp))) {
      findings.push({ severity: "breaking", path: key, kind: "operation-changed", detail: `"${key}"'s request/response shape changed upstream` });
    }
  }
  for (const key of upstreamOps.keys()) {
    if (!storedOps.has(key)) {
      findings.push({ severity: "additive", path: key, kind: "operation-added", detail: `"${key}" is new upstream` });
    }
  }
  return findings;
}
