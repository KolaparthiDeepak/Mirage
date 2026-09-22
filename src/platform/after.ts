// Plan 20 — the waitUntil/after shim. On Vercel, next/server's after() ties
// background work to the serverless function's lifetime; self-hosted, there
// is no such boundary to extend — the process just needs to not crash on an
// unhandled rejection from work nobody is awaiting.
//
// Not yet wired into the existing after() call sites (app/m/[...slug]/route.ts
// and the callback/traffic-recording paths it schedules) — those already
// work correctly on both deploy targets today, because Next's own
// after()/waitUntil work on any Next.js server, self-hosted included, not
// just Vercel. This module exists for code that doesn't want a hard
// dependency on next/server and isn't inside a request scope to begin with —
// self-host-cron.ts, which runs from instrumentation.ts at server startup.
export type AfterFn = (work: () => void | Promise<void>) => void;

/** Fire-and-forget: run `work`, never block the caller on it, log (never
 *  throw) if it rejects. This is what "no request-scope boundary" means in
 *  practice — there's nothing to attach the promise to, so the only contract
 *  left is "don't crash the process". */
export const selfHostAfter: AfterFn = (work) => {
  Promise.resolve()
    .then(work)
    .catch((e: unknown) => console.error(`[platform] background work failed: ${(e as Error).message}`));
};
