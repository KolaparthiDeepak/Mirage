import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { parseRequest } from "@/src/engine/request";
import { resolve } from "@/src/engine/resolve";
import type { UpstreamConfig } from "@/src/engine/types";
import { proxyUnmatchedRequest } from "@/src/proxy";
import { clientHash, clientIp } from "@/src/store/client-hash";
import { redactBody, redactHeaders } from "@/src/store/redact";
import { getCurrentConfig, getRuntimeStore } from "@/src/store/runtime-source";
import { shouldRecord, truncateBody } from "@/src/store/traffic-limits";
import type { TrafficEntry } from "@/src/store/types";

// Plan 07: absent, "off", or the global kill switch → today's behaviour exactly.
function upstreamActive(upstream: UpstreamConfig | undefined): upstream is UpstreamConfig {
  return (
    process.env.MIRAGE_UPSTREAM !== "off" &&
    upstream != null &&
    (upstream.mode === "record" || upstream.mode === "passthrough")
  );
}

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "*",
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });
}

// Plan 04: recording is independent of where *config* came from — a
// bundle-sourced project still gets its traffic recorded to the store. The
// driver is reached only through the lazy singleton in runtime-source.ts
// (dynamic import — see that file for why), and every failure here is caught
// and logged, never allowed to affect a response that has already been sent.
async function recordTrafficEntry(entry: TrafficEntry): Promise<void> {
  if (process.env.MIRAGE_RECORD_TRAFFIC === "off") return;
  try {
    const store = await getRuntimeStore();
    await store.recordTraffic(entry);
  } catch (e) {
    console.error(`[traffic] failed to record request for "${entry.slug}": ${(e as Error).message}`);
  }
}

async function handle(req: Request, ctx: { params: Promise<{ slug: string[] }> }): Promise<Response> {
  const startedAt = Date.now();
  const { slug: parts } = await ctx.params;
  const slug = parts[0]!;
  const subPath = "/" + parts.slice(1).join("/");
  const found = await getCurrentConfig(slug);

  if (!found) return json(404, { error: "unknown project", slug });
  const { config: project, configVersion } = found;

  // Introspection: /m/<slug>/__spec — served here because Next.js excludes the
  // underscore-prefixed `__spec` folder from routing, so a dedicated route file
  // cannot exist. Handled before parseRequest.
  if (parts.length === 2 && parts[1] === "__spec" && req.method === "GET") {
    return project.openApiDoc != null
      ? Response.json(project.openApiDoc)
      : json(404, { error: "no openapi spec", slug });
  }

  const cors = project.defaults.cors ? CORS_HEADERS : {};

  if (req.method === "OPTIONS" && project.defaults.cors) {
    return new Response(null, { status: 204, headers: cors });
  }

  const parsed = await parseRequest(req, subPath);
  const result = resolve(parsed, project);

  // Plan 07: the proxy is strictly a fallback for what the mock does not know.
  // Only an *unmatched* request can reach it, so turning it on can never change
  // a matched rule's behaviour.
  if (result.matchedRuleId === null && upstreamActive(project.upstream)) {
    let search = "";
    try { search = new URL(req.url).search; } catch { /* keep "" */ }

    const outcome = await proxyUnmatchedRequest({
      slug,
      upstream: project.upstream,
      method: req.method,
      subPath,
      search,
      reqHeaders: parsed.headers,
      reqBody: parsed.rawBody || null,
    });

    if ("rateLimited" in outcome) {
      return json(429, { error: "upstream rate limit exceeded for this project", slug }, cors);
    }

    const resHeaders: Record<string, string> = { ...outcome.response.headers, ...cors, "x-mock-matched": "false" };
    const rec = outcome.record;
    if (rec && shouldRecord(slug, rec.status, false)) {
      try {
        const reqBody = truncateBody(redactBody(parsed.rawBody || null));
        const resBody = truncateBody(redactBody(rec.bodyText));
        after(() =>
          recordTrafficEntry({
            id: randomUUID(),
            slug,
            at: new Date(startedAt).toISOString(),
            method: req.method,
            path: subPath,
            query: parsed.query,
            reqHeaders: redactHeaders(parsed.headers),
            reqBody: reqBody.body,
            status: rec.status,
            resHeaders: redactHeaders(resHeaders),
            resBody: resBody.body,
            matchedRuleId: null,
            durationMs: Date.now() - startedAt,
            warnings: rec.error ? [`upstream ${rec.error}`] : [],
            clientHash: clientHash(clientIp(req.headers)),
            configVersion,
            truncated: reqBody.truncated || resBody.truncated || rec.truncated,
            viaUpstream: true,
          }),
        );
      } catch (e) {
        console.error(`[traffic] could not schedule upstream recording for "${slug}": ${(e as Error).message}`);
      }
    }

    console.log(JSON.stringify({
      t: new Date().toISOString(), proj: slug, m: req.method, path: subPath,
      rule: null, status: outcome.response.status, matched: false, upstream: true,
    }));
    return new Response(outcome.response.bodyText, { status: outcome.response.status, headers: resHeaders });
  }

  if (result.delayMs > 0) {
    await new Promise((r) => setTimeout(r, Math.min(result.delayMs, 9000)));
  }

  console.log(JSON.stringify({
    t: new Date().toISOString(),
    proj: slug,
    m: req.method,
    path: subPath,
    rule: result.matchedRuleId,
    status: result.status,
    matched: result.matchedRuleId !== null,
    warns: result.warnings.length,
  }));

  const headers: Record<string, string> = {
    ...result.headers,
    ...cors,
    "x-mock-rule-id": result.matchedRuleId ?? "",
    "x-mock-matched": String(result.matchedRuleId !== null),
  };
  let payload: BodyInit | null;
  let resBodyText: string | null;
  if (result.body === null || result.body === undefined) {
    payload = null;
    resBodyText = null;
  } else if (typeof result.body === "string") {
    payload = result.body;
    resBodyText = result.body;
  } else {
    payload = JSON.stringify(result.body);
    resBodyText = payload;
  }

  // Plan 04: written after the response, in Next's after() (the App Router
  // equivalent of Vercel's waitUntil) — never before, never awaited by the
  // request. Sampling and redaction/truncation are applied here, on the
  // fields already computed above, at zero extra cost to the hot path itself.
  //
  // Per-project redaction config and a per-project kill switch are named in
  // plan 04 but need a project-level settings field that doesn't exist in the
  // schema yet; only the global defaults (header denylist + heuristic) and
  // the global MIRAGE_RECORD_TRAFFIC kill switch ship in this pass.
  const matched = result.matchedRuleId !== null;
  if (shouldRecord(slug, result.status, matched)) {
    try {
      // after() itself — not just the callback it schedules — throws
      // synchronously if called outside Next's real request-scope context
      // (confirmed: it is not a lint-only concern, it is an uncaught
      // exception). That can never be allowed to affect a response that has
      // not been returned yet, so the call itself is inside this try, not
      // just recordTrafficEntry's internals.
      const reqBody = truncateBody(redactBody(parsed.rawBody || null));
      const resBody = truncateBody(redactBody(resBodyText));
      after(() =>
        recordTrafficEntry({
          id: randomUUID(),
          slug,
          at: new Date(startedAt).toISOString(),
          method: req.method,
          path: subPath,
          query: parsed.query,
          reqHeaders: redactHeaders(parsed.headers),
          reqBody: reqBody.body,
          status: result.status,
          resHeaders: redactHeaders(headers),
          resBody: resBody.body,
          matchedRuleId: result.matchedRuleId,
          durationMs: Date.now() - startedAt,
          warnings: result.warnings,
          clientHash: clientHash(clientIp(req.headers)),
          configVersion,
          truncated: reqBody.truncated || resBody.truncated,
          viaUpstream: false,
        }),
      );
    } catch (e) {
      console.error(`[traffic] could not schedule recording for "${slug}": ${(e as Error).message}`);
    }
  }

  return new Response(payload, { status: result.status, headers });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
