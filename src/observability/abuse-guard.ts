// Plan 24 — abuse controls on the mock route, the one fully public,
// unauthenticated endpoint in this product. Per-IP, generous default (real
// traffic from a CI suite or a busy dev loop must never trip this), 429
// rather than an unbounded bill or an unbounded queue.
//
// A second, separate fixed-window counter — not a reuse of
// src/proxy/rate-limit.ts's allowUpstreamCall. That module is specific to
// plan 07's per-project upstream-call budget and has a dozen existing
// callers across plans 07/12/22; extracting a shared primitive out from
// under it during a reliability pass is exactly the kind of hot-path risk
// this plan exists to avoid, for a ~15-line counter that isn't worth the
// blast radius. Global per-IP, not per-project: a per-project *monthly*
// cap (the plan's other abuse control) needs a longer-lived counter this
// fixed-window shape doesn't fit, and is deferred — see the plan-24 commit.
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 600; // 10 req/s sustained — generous; a real abuser looks nothing like this

const windows = new Map<string, { count: number; startedAt: number }>();

/** Returns true if the request is allowed (and counts it), false if this
 *  client is over its limit for the current window. */
export function allowMockRequest(clientKey: string, limit: number = DEFAULT_LIMIT): boolean {
  const now = Date.now();
  const w = windows.get(clientKey);
  if (!w || now - w.startedAt >= WINDOW_MS) {
    windows.set(clientKey, { count: 1, startedAt: now });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

/** Test hook — reset all windows. */
export function __resetMockRateLimit(): void {
  windows.clear();
}
