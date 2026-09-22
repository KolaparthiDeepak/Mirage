// Plan 20 — Next.js's app-startup hook, called once when the server starts.
// Works identically on Vercel and self-hosted `next start`/the standalone
// output.
//
// The `process.env.NEXT_RUNTIME === "nodejs"` guard around a dynamic
// import() is the literal pattern Next.js's own docs prescribe for reaching
// Node-only code from instrumentation.ts — Next's bundler special-cases
// exactly this shape to exclude the imported module from the edge-targeted
// build it also produces for this entry point. Without it (a custom env var
// like MIRAGE_SELF_HOST_CRON alone doesn't trigger the special-casing —
// bundling is a build-time decision, made before any env var is read at
// runtime), the self-host-cron dependency chain reaches better-sqlite3 (a
// native addon, real-`require()`-only, never webpack-bundleable at all) and
// the build fails outright with "Module not found: Can't resolve 'fs'",
// whether or not MIRAGE_SELF_HOST_CRON is ever turned on.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startIfEnabled } = await import("./src/platform/instrumentation-node");
    await startIfEnabled();
  }
}
