// Plan 20 — the actual self-host cron bootstrap, split out of
// instrumentation.ts so it's only ever reached through the process.env.NEXT_RUNTIME
// === "nodejs" gate there. That specific, literal conditional is the pattern
// Next.js's own docs prescribe for using Node-only packages (here:
// self-host-cron.ts -> better-sqlite3, a native addon that cannot be
// webpack-bundled at all, only ever real-`require()`d at runtime) from
// instrumentation.ts — Next's bundler special-cases exactly this shape to
// exclude the dynamically-imported module from the edge-targeted build.
export async function startIfEnabled(): Promise<void> {
  if (process.env.MIRAGE_SELF_HOST_CRON !== "on") return;
  const { startSelfHostCron } = await import("./self-host-cron");
  const intervalMs = process.env.MIRAGE_SELF_HOST_CRON_INTERVAL_MS
    ? Number(process.env.MIRAGE_SELF_HOST_CRON_INTERVAL_MS)
    : undefined;
  startSelfHostCron({ intervalMs });
}
