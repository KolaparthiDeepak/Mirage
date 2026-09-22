import type { Rule } from "../compile/schema";
import { redactBody } from "../store/redact";
import type { ImportResult, RuleDraft } from "./types";

// Plan 08.1 — parse a HAR into RuleDrafts. HAR's value is that it carries real
// response bodies, so a draft here is a usable mock, not a stub.

export const MAX_HAR_BYTES = 5 * 1024 * 1024;
export const MAX_HAR_ENTRIES = 500;

export interface HarFilter {
  /** If set, only entries whose host is in this list. */
  includeHosts?: string[];
  excludeHosts?: string[];
  /** Default ["json", "text"] — a real HAR is mostly images/fonts/JS. */
  contentTypes?: Array<"json" | "text" | "other">;
  /** Status classes to keep, e.g. [2, 4]. Default: all. */
  statusClasses?: number[];
}

interface HarEntry {
  request?: { method?: string; url?: string; postData?: { text?: string } };
  response?: { status?: number; content?: { text?: string; mimeType?: string } };
}

// uuid, all-digits, or long hex — the shapes an id path segment takes. `/2024/`
// is a false positive this accepts; grouping by the rest of the path keeps it
// from merging unrelated endpoints.
const ID_SEGMENT = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[0-9a-fA-F]{17,})$/;

function classifyContentType(mime: string | undefined): "json" | "text" | "other" {
  if (!mime) return "other";
  const m = mime.toLowerCase();
  if (m.includes("json")) return "json";
  if (m.startsWith("text/") || m.includes("xml") || m.includes("csv")) return "text";
  return "other";
}

function parameterisePath(pathname: string): string {
  return pathname
    .split("/")
    .map((seg) => (seg && ID_SEGMENT.test(seg) ? ":id" : seg))
    .join("/");
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "root";
}

export function parseHar(text: string, filter: HarFilter = {}): ImportResult | { error: string } {
  if (text.length > MAX_HAR_BYTES) return { error: `HAR is over ${MAX_HAR_BYTES / 1024 / 1024} MB` };

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { error: "not valid JSON" };
  }
  const entries = (doc as { log?: { entries?: unknown } })?.log?.entries;
  if (!Array.isArray(entries)) return { error: "not a HAR file — no log.entries array" };
  if (entries.length > MAX_HAR_ENTRIES) {
    return { error: `HAR has ${entries.length} entries; the limit is ${MAX_HAR_ENTRIES}. Filter it in devtools first.` };
  }

  const wantTypes = new Set(filter.contentTypes ?? ["json", "text"]);
  const unsupported: string[] = [];
  let skipped = 0;

  // method + parameterised path -> the drafts-in-progress, plus a set of the
  // distinct response bodies seen (to count variants).
  const groups = new Map<string, { rule: Rule; bodies: Set<string>; refs: string[] }>();

  entries.forEach((raw, i) => {
    const e = raw as HarEntry;
    const method = (e.request?.method ?? "GET").toUpperCase();
    const rawUrl = e.request?.url;
    if (!rawUrl) {
      skipped++;
      return;
    }
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      skipped++;
      return;
    }

    if (filter.includeHosts?.length && !filter.includeHosts.includes(url.host)) return;
    if (filter.excludeHosts?.includes(url.host)) return;

    const status = e.response?.status ?? 0;
    if (filter.statusClasses?.length && !filter.statusClasses.includes(Math.floor(status / 100))) return;

    const ctype = classifyContentType(e.response?.content?.mimeType);
    if (!wantTypes.has(ctype)) {
      skipped++;
      return;
    }
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      unsupported.push(`entry ${i}: method ${method} is not supported`);
      return;
    }

    const path = parameterisePath(url.pathname || "/");
    const key = `${method} ${path}`;
    const bodyText = redactBody(e.response?.content?.text ?? null) ?? undefined;

    let group = groups.get(key);
    if (!group) {
      let body: unknown = bodyText;
      try {
        if (bodyText) body = JSON.parse(bodyText);
      } catch {
        /* keep as string */
      }
      const rule: Rule = {
        id: `${method.toLowerCase()}-${slug(path)}-har`,
        request: { method: method as Rule["request"]["method"], path },
        response: { status: status || 200, body },
      };
      group = { rule, bodies: new Set(), refs: [] };
      groups.set(key, group);
    }
    if (bodyText) group.bodies.add(bodyText);
    group.refs.push(String(i));
  });

  const drafts: RuleDraft[] = [];
  for (const [, group] of groups) {
    if (group.bodies.size > 1) {
      unsupported.push(
        `${group.rule.request.method} ${group.rule.request.path}: ${group.bodies.size} different response bodies seen — the first is used, edit or split it after import`,
      );
    }
    drafts.push({ rule: group.rule, source: "har", sourceRef: `entries ${group.refs.join(",")}` });
  }

  if (skipped > 0) unsupported.push(`${skipped} entr${skipped === 1 ? "y" : "ies"} skipped by the content-type / URL filter`);
  if (drafts.length === 0) return { error: "nothing to import after filtering — loosen the filters" };

  return { drafts, unsupported };
}
