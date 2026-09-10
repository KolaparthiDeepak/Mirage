// Plan 07, controls #3, #4, #6, #7 (redaction is applied by the caller, in the
// mock route, using plan 04's helpers — same path as any other recording).
//
// This does exactly one validated upstream request and returns what came back.
// It never follows a redirect (control #3) and never reads more than the cap
// (control #4). The URL handed in MUST already have passed
// assertSafeUpstreamUrl() — this module does not re-validate.

const HARD_TIMEOUT_MS = 5000;
const MAX_BYTES = 5 * 1024 * 1024;

// RFC 7230 §6.1 hop-by-hop headers — never forwarded in either direction.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface ForwardInput {
  /** Already validated by assertSafeUpstreamUrl(). */
  targetUrl: URL;
  method: string;
  /** Lowercased header keys, as parseRequest produces. */
  reqHeaders: Record<string, string>;
  body: string | null;
  forwardAuth: boolean;
  timeoutMs: number;
}

export interface ForwardResult {
  status: number;
  headers: Record<string, string>;
  bodyText: string | null;
  truncated: boolean;
  /** Set when the request never completed — status is then a synthesised 504. */
  error?: "timeout" | "network";
}

function outboundHeaders(input: ForwardInput): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(input.reqHeaders)) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key)) continue;
    if (key === "host") continue; // fetch sets Host from the URL (control #6)
    if (key === "content-length") continue; // fetch recomputes it
    if (key === "authorization" && !input.forwardAuth) continue; // control #6
    h.set(key, v);
  }
  return h;
}

function responseHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k)) return;
    // fetch has already decoded the body; forwarding the original framing
    // headers would make the client try to decode plain bytes.
    if (k === "content-encoding" || k === "content-length") return;
    out[k] = value;
  });
  return out;
}

async function readCapped(res: Response): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.length > MAX_BYTES) {
      chunks.push(value.subarray(0, MAX_BYTES - total));
      total = MAX_BYTES;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.length;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return { text: new TextDecoder().decode(merged), truncated };
}

export async function forwardToUpstream(input: ForwardInput): Promise<ForwardResult> {
  const controller = new AbortController();
  const timeout = Math.min(input.timeoutMs || HARD_TIMEOUT_MS, HARD_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(input.targetUrl, {
      method: input.method,
      headers: outboundHeaders(input),
      body: input.body ?? undefined,
      redirect: "manual", // control #3 — a 3xx comes straight back, never followed
      signal: controller.signal,
    });

    const { text, truncated } = await readCapped(res);
    return {
      status: res.status,
      headers: responseHeaders(res),
      bodyText: text.length > 0 ? text : null,
      truncated,
    };
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    return {
      status: 504,
      headers: { "content-type": "application/json" },
      bodyText: JSON.stringify({
        error: isAbort ? "upstream timed out" : "upstream request failed",
        upstream: input.targetUrl.origin,
      }),
      truncated: false,
      error: isAbort ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}
