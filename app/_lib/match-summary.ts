import type { MatchCondition } from "@/src/viewer/curl";

function target(c: MatchCondition): string {
  if (c.header !== undefined) return `header.${c.header}`;
  if (c.query !== undefined) return `query.${c.query}`;
  const jp = c.jsonPath ?? "";
  if (jp.startsWith("$.")) return `body.${jp.slice(2)}`;
  if (jp.startsWith("$")) return jp.slice(1);
  return jp;
}

function opValue(c: MatchCondition): string {
  if (c.equals !== undefined) return `= "${c.equals}"`;
  if (c.notEquals !== undefined) return `≠ "${c.notEquals}"`;
  if (c.contains !== undefined) return `⊃ "${c.contains}"`;
  if (c.regex !== undefined) return `~ /${c.regex}/`;
  if (c.exists !== undefined) return c.exists ? "exists" : "absent";
  return "";
}

/** One-line human summary of a case's match conditions.
 *  Empty array -> "fallback (any request)"; otherwise TARGET OP VALUE per
 *  condition, joined with " · ". */
export function matchSummary(match: MatchCondition[]): string {
  if (match.length === 0) return "fallback (any request)";
  return match
    .map((c) => {
      const ov = opValue(c);
      return ov ? `${target(c)} ${ov}` : target(c);
    })
    .join(" · ");
}
