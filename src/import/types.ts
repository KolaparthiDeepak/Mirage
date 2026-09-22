import type { Rule } from "../compile/schema";

// Plan 08 — the shared shape every importer produces. It is `ruleSchema`'s
// shape plus provenance, so a draft is one `ruleSchema.parse()` away from a
// real rule. Nothing is written to config without a preview + explicit save.
export interface RuleDraft {
  rule: Rule;
  source: "har" | "curl" | "postman";
  /** Where this draft came from — a HAR entry index, the pasted line, etc. */
  sourceRef: string;
}

export interface ImportResult {
  drafts: RuleDraft[];
  /** Flags / fields the parser saw but does not support — surfaced to the
   *  user, never silently dropped (plan 08: "a mock built from a
   *  half-understood command is worse than a rejection"). */
  unsupported: string[];
}
