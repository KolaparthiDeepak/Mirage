import type { Verdict } from "@/src/viewer/verdict";

export function prettyBody(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export type VerdictKind = "hit" | "divert" | "nomatch" | "unknown";

export function verdictText(v: Verdict): { text: string; kind: VerdictKind } {
  switch (v.kind) {
    case "hit":
      return { text: `✓ matched case: ${v.caseId}`, kind: "hit" };
    case "divert":
      return { text: `→ landed on: ${v.landedOn}`, kind: "divert" };
    case "nomatch":
      return { text: "→ no route matched (fell through to notFound)", kind: "nomatch" };
    case "unknown":
      return { text: "· could not confirm which case matched", kind: "unknown" };
  }
}

export function parseHeaderLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}
