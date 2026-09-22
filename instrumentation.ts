// Plan 20 — Next.js's app-startup hook, called once when the server starts.
// Works identically on Vercel and self-hosted `next start`/the standalone
// output — the two deploy targets don't otherwise differ here, so gating is
// an explicit env opt-in, not deploy-target detection (see
// src/platform/self-host-cron.ts for why this defaults to off).
export async function register(): Promise<void> {
  if (process.env.MIRAGE_SELF_HOST_CRON !== "on") return;
  const { startSelfHostCron } = await import("./src/platform/self-host-cron");
  const intervalMs = process.env.MIRAGE_SELF_HOST_CRON_INTERVAL_MS
    ? Number(process.env.MIRAGE_SELF_HOST_CRON_INTERVAL_MS)
    : undefined;
  startSelfHostCron({ intervalMs });
}
