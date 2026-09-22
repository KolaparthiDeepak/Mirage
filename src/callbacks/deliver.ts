// Plan 12 — deliver one callback. Reuses plan 07's SSRF guard and forwarder
// verbatim (one implementation, one test suite, two callers).
import { randomUUID } from "node:crypto";
import { forwardToUpstream } from "../proxy/forward";
import { allowUpstreamCall } from "../proxy/rate-limit";
import { assertSafeUpstreamUrl, UpstreamError } from "../proxy/ssrf";
import type { CallbackConfig } from "../engine/types";

export interface CallbackContext {
  request: { path: Record<string, string>; query: Record<string, string>; body: unknown };
  response: { status: number; body: unknown };
}

/** Resolve values by dotted path against a root object; undefined if absent. */
function dig(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

/** The callback grammar: the request/response namespaces this plan needs,
 *  plus uuid/now from the base engine. A token that resolves to nothing is
 *  left as-is and noted. */
export function renderCallbackString(input: string, ctx: CallbackContext, warnings: string[]): string {
  return input.replace(TOKEN, (whole, expr: string) => {
    const e = expr.trim();
    if (e === "uuid") return randomUUID();
    if (e === "now") return new Date().toISOString();
    if (e === "response.status") return String(ctx.response.status);
    let value: unknown;
    if (e.startsWith("response.body.")) value = dig(ctx.response.body, e.slice("response.body.".length));
    else if (e.startsWith("request.body.")) value = dig(ctx.request.body, e.slice("request.body.".length));
    else if (e.startsWith("request.path.")) value = ctx.request.path[e.slice("request.path.".length)];
    else if (e.startsWith("request.query.")) value = ctx.request.query[e.slice("request.query.".length)];
    else {
      warnings.push(`unknown callback token {{${e}}}`);
      return whole;
    }
    if (value === undefined) {
      warnings.push(`callback token {{${e}}} resolved to nothing`);
      return whole;
    }
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

export function renderCallbackValue(value: unknown, ctx: CallbackContext, warnings: string[]): unknown {
  if (typeof value === "string") {
    // A body value that is exactly one token keeps its native type.
    const only = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (only) {
      const rendered = renderCallbackString(value, ctx, warnings);
      return rendered === value ? value : tryJson(rendered);
    }
    return renderCallbackString(value, ctx, warnings);
  }
  if (Array.isArray(value)) return value.map((v) => renderCallbackValue(v, ctx, warnings));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renderCallbackValue(v, ctx, warnings)]));
  }
  return value;
}

function tryJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export interface CallbackAttempt {
  attempt: number;
  status: number;
  error?: string;
  url: string;
}

export interface CallbackResult {
  attempts: CallbackAttempt[];
  delivered: boolean;
  warnings: string[];
}

/** Deliver a callback with retry. Never throws — a failed callback is a
 *  visible failure (the returned attempts), not an exception. */
export async function deliverCallback(
  slug: string,
  callback: CallbackConfig,
  ctx: CallbackContext,
): Promise<CallbackResult> {
  const warnings: string[] = [];
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(callback.headers ?? {})) {
    headers[k.toLowerCase()] = renderCallbackString(v, ctx, warnings);
  }
  const body =
    callback.body === undefined ? undefined : JSON.stringify(renderCallbackValue(callback.body, ctx, warnings));
  if (body && !headers["content-type"]) headers["content-type"] = "application/json";

  let target: URL;
  try {
    target = await assertSafeUpstreamUrl(callback.url);
  } catch (e) {
    const message = e instanceof UpstreamError ? e.message : "callback URL failed validation";
    return { attempts: [{ attempt: 1, status: 0, error: message, url: callback.url }], delivered: false, warnings };
  }

  const maxAttempts = callback.retry?.attempts ?? 1;
  const backoffMs = callback.retry?.backoffMs ?? 1000;
  const attempts: CallbackAttempt[] = [];

  for (let n = 1; n <= maxAttempts; n++) {
    if (!allowUpstreamCall(slug)) {
      attempts.push({ attempt: n, status: 0, error: "per-project callback rate limit exceeded", url: target.href });
      break;
    }
    const res = await forwardToUpstream({
      targetUrl: target,
      method: callback.method,
      reqHeaders: headers,
      body: body ?? null,
      forwardAuth: false,
      timeoutMs: 5000,
    });
    attempts.push({ attempt: n, status: res.status, error: res.error, url: target.href });
    if (!res.error && res.status < 500) return { attempts, delivered: true, warnings };
    if (n < maxAttempts && backoffMs > 0) await new Promise((r) => setTimeout(r, backoffMs));
  }

  return { attempts, delivered: false, warnings };
}
