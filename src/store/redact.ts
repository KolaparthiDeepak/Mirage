// Plan 04: "values are replaced with *** before storage, never after." Pure,
// synchronous, no I/O — safe to run on the hot path just before the
// fire-and-forget traffic write.
const MASK = "***";

export const DEFAULT_REDACTED_HEADERS = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
];

// A JWT (three base64url segments) or a long opaque token — the shapes a
// secret accidentally logged through a mock server actually takes. Heuristic,
// not exhaustive: it exists to catch what the denylist and per-project config
// didn't think to name, not to replace them.
const JWT_RE = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const LONG_TOKEN_RE = /^[A-Za-z0-9_\-.]{32,}$/;

export function looksLikeSecret(value: string): boolean {
  return JWT_RE.test(value) || LONG_TOKEN_RE.test(value);
}

export interface RedactionConfig {
  /** Extra header names, beyond DEFAULT_REDACTED_HEADERS. */
  headers?: string[];
  /** JSON paths into the body, dot notation ("card.number"), no leading "$.". */
  bodyPaths?: string[];
  /** Turns off the JWT/long-token heuristic for this project. */
  disableHeuristic?: boolean;
}

export function redactHeaders(
  headers: Record<string, string>,
  config: RedactionConfig = {},
): Record<string, string> {
  const denylist = new Set(
    [...DEFAULT_REDACTED_HEADERS, ...(config.headers ?? [])].map((h) => h.toLowerCase()),
  );
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const shouldMask = denylist.has(k.toLowerCase()) || (!config.disableHeuristic && looksLikeSecret(v));
    out[k] = shouldMask ? MASK : v;
  }
  return out;
}

function redactAtPath(value: unknown, remaining: string[]): unknown {
  if (remaining.length === 0) return MASK;
  if (value === null || typeof value !== "object") return value; // path doesn't exist here — nothing to redact
  const [head, ...rest] = remaining;
  if (Array.isArray(value)) return value.map((v) => redactAtPath(v, remaining));
  const obj = value as Record<string, unknown>;
  if (!(head! in obj)) return value;
  return { ...obj, [head!]: redactAtPath(obj[head!], rest) };
}

/** Redacts a JSON request/response body, given as its raw text. Non-JSON
 *  bodies (or a body that fails to parse) pass through the heuristic scan on
 *  the whole string instead — still better than storing a secret unredacted
 *  just because it wasn't wrapped in JSON. */
export function redactBody(rawBody: string | null, config: RedactionConfig = {}): string | null {
  if (rawBody == null || rawBody === "") return rawBody;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return !config.disableHeuristic && looksLikeSecret(rawBody) ? MASK : rawBody;
  }

  let out = parsed;
  for (const path of config.bodyPaths ?? []) {
    out = redactAtPath(out, path.split("."));
  }
  if (!config.disableHeuristic) {
    out = redactSecretLookingStrings(out);
  }
  return JSON.stringify(out);
}

function redactSecretLookingStrings(value: unknown): unknown {
  if (typeof value === "string") return looksLikeSecret(value) ? MASK : value;
  if (Array.isArray(value)) return value.map(redactSecretLookingStrings);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactSecretLookingStrings(v)]),
    );
  }
  return value;
}
