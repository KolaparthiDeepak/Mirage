// Plan 21 — the 3 built-in saved views. Not stored rows: available to every
// project without a saveView call, and an alert's `view` field can name one
// directly by id.
import type { TrafficFilter } from "../store/types";

export interface BuiltinView {
  id: "unmatched" | "errors" | "slow";
  name: string;
  query: Omit<TrafficFilter, "slug">;
}

export const BUILTIN_VIEWS: readonly BuiltinView[] = [
  { id: "unmatched", name: "Unmatched", query: { unmatchedOnly: true } },
  { id: "errors", name: "Errors (5xx)", query: { statusFrom: 500, statusTo: 599 } },
  { id: "slow", name: "Slow (>= 1s)", query: { durationMsFrom: 1000 } },
];

export function resolveBuiltinViewQuery(id: string): Omit<TrafficFilter, "slug"> | null {
  return BUILTIN_VIEWS.find((v) => v.id === id)?.query ?? null;
}
