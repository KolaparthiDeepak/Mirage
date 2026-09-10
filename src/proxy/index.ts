// Plan 07 — the one entry point the mock route calls when resolve() returned
// notFound and the project has an active upstream. Everything SSRF-relevant
// lives under src/proxy/; the route just wires the outcome into a Response and
// (for `record` mode) into plan 04's after() recording path.
import type { UpstreamConfig } from "../engine/types";
import { forwardToUpstream } from "./forward";
import { allowUpstreamCall } from "./rate-limit";
import { assertSafeUpstreamUrl, UpstreamError } from "./ssrf";

export interface ProxyOutcome {
  response: { status: number; headers: Record<string, string>; bodyText: string | null };
  /** null in passthrough mode or when there is nothing worth storing. */
  record: { status: number; bodyText: string | null; truncated: boolean; error?: string } | null;
}

export interface ProxyInput {
  slug: string;
  upstream: UpstreamConfig;
  method: string;
  /** Path after /m/<slug>, always starts with "/". */
  subPath: string;
  /** Raw query string including the leading "?", or "". */
  search: string;
  reqHeaders: Record<string, string>;
  reqBody: string | null;
}

export type ProxyResult = ProxyOutcome | { rateLimited: true };

function buildTarget(base: URL, subPath: string, search: string): URL {
  const target = new URL(base.toString());
  const prefix = target.pathname === "/" ? "" : target.pathname.replace(/\/$/, "");
  target.pathname = prefix + subPath;
  target.search = search;
  return target;
}

export async function proxyUnmatchedRequest(input: ProxyInput): Promise<ProxyResult> {
  if (!allowUpstreamCall(input.slug)) return { rateLimited: true };

  // Control #2, forward-time: re-validate on every call, not just at save —
  // this is the DNS-rebinding defense. A failure here after the URL passed at
  // save time is a security event, not a user error: 502, and nothing about
  // the attempt is recorded.
  let base: URL;
  try {
    base = await assertSafeUpstreamUrl(input.upstream.url);
  } catch (e) {
    const message = e instanceof UpstreamError ? e.message : "upstream URL failed validation";
    console.error(`[proxy] refusing upstream for "${input.slug}": ${message}`);
    return {
      response: {
        status: 502,
        headers: { "content-type": "application/json" },
        bodyText: JSON.stringify({ error: "upstream is not reachable safely", detail: message }),
      },
      record: null,
    };
  }

  const target = buildTarget(base, input.subPath, input.search);
  const fwd = await forwardToUpstream({
    targetUrl: target,
    method: input.method,
    reqHeaders: input.reqHeaders,
    body: input.reqBody,
    forwardAuth: input.upstream.forwardAuth,
    timeoutMs: input.upstream.timeoutMs,
  });

  const headers = { ...fwd.headers, "x-mock-upstream": base.origin };
  const record =
    input.upstream.mode === "record"
      ? { status: fwd.status, bodyText: fwd.bodyText, truncated: fwd.truncated, error: fwd.error }
      : null;

  return { response: { status: fwd.status, headers, bodyText: fwd.bodyText }, record };
}
