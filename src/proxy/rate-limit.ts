// Plan 07, control #5 — per-project upstream call rate limit.
//
// Fixed 60-second window, in-memory. Not distributed: on a multi-instance
// deploy each instance enforces its own window, so the effective ceiling is
// LIMIT × instances. That is acceptable for a cost-control guard (the point
// is "a chatty client can't run up an unbounded upstream bill", not exact
// fairness). A shared counter (the store, or Supabase) is the upgrade path if
// it ever needs to be exact.
// ponytail: per-instance window; move the counter to the store if exactness matters.

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;

const windows = new Map<string, { count: number; startedAt: number }>();

/** Returns true if the call is allowed (and counts it), false if the project
 *  is over its limit for the current window. */
export function allowUpstreamCall(slug: string, limit: number = DEFAULT_LIMIT): boolean {
  const now = Date.now();
  const w = windows.get(slug);
  if (!w || now - w.startedAt >= WINDOW_MS) {
    windows.set(slug, { count: 1, startedAt: now });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

/** Test hook — reset all windows. */
export function __resetRateLimit(): void {
  windows.clear();
}
