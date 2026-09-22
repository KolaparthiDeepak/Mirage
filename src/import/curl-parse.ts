import type { Rule } from "../compile/schema";
import type { ImportResult, RuleDraft } from "./types";

// Plan 08.2 — parse a pasted `curl` command into one RuleDraft. A deliberately
// small flag set; anything else is reported in `unsupported`, never dropped.

// Flags that take no argument and carry no meaning for a mock (transport /
// output noise) — recognised and ignored silently.
const IGNORED_BOOL = new Set([
  "-s", "--silent", "-S", "--show-error", "-L", "--location", "-k", "--insecure",
  "-i", "--include", "-v", "--verbose", "--compressed", "-f", "--fail", "-#", "--progress-bar",
  "-g", "--globoff",
]);
// Flags that take an argument and carry no meaning for a mock — the flag and
// its value are both consumed and ignored.
const IGNORED_ARG = new Set(["-A", "--user-agent", "-e", "--referer", "-o", "--output", "--connect-timeout", "-m", "--max-time", "--retry"]);

const DATA_FLAGS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode"]);

/** POSIX-ish shell split: single quotes are literal, double quotes allow \" and
 *  \\, a trailing backslash continues onto the next line. Enough for curl
 *  commands people paste; not a full shell. */
export function shellSplit(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let has = false;
  let i = 0;
  const s = input.replace(/\\\r?\n/g, " ");
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "'") {
      has = true;
      i++;
      while (i < s.length && s[i] !== "'") cur += s[i++];
      i++; // closing '
    } else if (ch === '"') {
      has = true;
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\\" && (s[i + 1] === '"' || s[i + 1] === "\\" || s[i + 1] === "$" || s[i + 1] === "`")) {
          cur += s[i + 1];
          i += 2;
        } else {
          cur += s[i++];
        }
      }
      i++; // closing "
    } else if (ch === "\\") {
      cur += s[i + 1] ?? "";
      i += 2;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has) {
        tokens.push(cur);
        cur = "";
        has = false;
      }
      i++;
    } else {
      cur += ch;
      has = true;
      i++;
    }
  }
  if (has) tokens.push(cur);
  return tokens;
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "root";
}

/** Body → match conditions on each primitive top-level field. Objects/arrays
 *  as values are noted, not matched (the author sets those by hand). */
function bodyToMatch(body: string, unsupported: string[]): Rule["request"]["match"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    unsupported.push("request body is not JSON — no match conditions were derived from it");
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    unsupported.push("request body is not a JSON object — no match conditions were derived from it");
    return undefined;
  }
  const match: NonNullable<Rule["request"]["match"]> = [];
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v === null || typeof v === "object") {
      unsupported.push(`body field "${k}" is a ${Array.isArray(v) ? "array" : "object"} — set that condition by hand`);
      continue;
    }
    match.push({ jsonPath: `$.${k}`, equals: String(v) });
  }
  return match.length > 0 ? match : undefined;
}

export function parseCurl(text: string): ImportResult | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: "paste a curl command" };

  let tokens = shellSplit(trimmed);
  if (tokens[0] === "curl") tokens = tokens.slice(1);
  if (tokens.length === 0) return { error: "no curl arguments found" };

  const unsupported: string[] = [];
  let method: string | undefined;
  let url: string | undefined;
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];
  let forceGet = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "-X" || t === "--request") {
      method = (tokens[++i] ?? "GET").toUpperCase();
    } else if (t === "-H" || t === "--header") {
      const raw = tokens[++i] ?? "";
      const idx = raw.indexOf(":");
      if (idx > 0) headers[raw.slice(0, idx).trim().toLowerCase()] = raw.slice(idx + 1).trim();
    } else if (DATA_FLAGS.has(t)) {
      dataParts.push(tokens[++i] ?? "");
    } else if (t === "-u" || t === "--user") {
      headers["authorization"] = `Basic ${Buffer.from(tokens[++i] ?? "").toString("base64")}`;
    } else if (t === "--url") {
      url = tokens[++i];
    } else if (t === "-G" || t === "--get") {
      forceGet = true;
    } else if (IGNORED_ARG.has(t)) {
      i++; // consume the argument too
    } else if (IGNORED_BOOL.has(t)) {
      // recognised, ignored
    } else if (t.startsWith("-")) {
      unsupported.push(`unrecognised flag: ${t}`);
    } else if (!url && /^https?:\/\//i.test(t)) {
      url = t;
    } else if (!url) {
      url = `https://${t}`; // curl accepts a bare host
    } else {
      unsupported.push(`unexpected argument: ${t}`);
    }
  }

  if (!url) return { error: "no URL found in the curl command" };

  // The docs generator (src/viewer/curl.ts) emits "$ORIGIN/path" — accept it so
  // a generated command round-trips.
  url = url.replace(/^\$\{?ORIGIN\}?/, "https://origin.invalid");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { error: `could not parse URL: ${url}` };
  }

  const body = dataParts.length > 0 ? dataParts.join("&") : undefined;
  const resolvedMethod = method ?? (forceGet ? "GET" : body ? "POST" : "GET");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(resolvedMethod)) {
    return { error: `unsupported method: ${resolvedMethod}` };
  }

  const match: NonNullable<Rule["request"]["match"]> = [];
  for (const [k, v] of parsedUrl.searchParams) match.push({ query: k, equals: v });
  if (body && (resolvedMethod === "POST" || resolvedMethod === "PUT" || resolvedMethod === "PATCH")) {
    const bodyMatch = bodyToMatch(body, unsupported);
    if (bodyMatch) match.push(...bodyMatch);
  } else if (body) {
    unsupported.push(`${resolvedMethod} with a request body — the body was ignored`);
  }

  const headerCount = Object.keys(headers).length;
  if (headerCount > 0) {
    unsupported.push(
      `${headerCount} request header(s) parsed but not turned into match conditions — add them on the rule if you need them`,
    );
  }

  const path = parsedUrl.pathname || "/";
  const rule: Rule = {
    id: `${resolvedMethod.toLowerCase()}-${slug(path)}-imported`,
    request: {
      method: resolvedMethod as Rule["request"]["method"],
      path,
      ...(match.length > 0 ? { match } : {}),
    },
    response: { status: 200, body: { TODO: "fill in the response body" } },
  };

  const draft: RuleDraft = { rule, source: "curl", sourceRef: trimmed.slice(0, 120) };
  return { drafts: [draft], unsupported };
}
