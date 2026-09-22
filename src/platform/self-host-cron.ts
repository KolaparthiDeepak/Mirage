// Plan 20 — in-process periodic sweep for self-hosted deployments, where
// there is no Vercel Cron to configure. Off by default (MIRAGE_SELF_HOST_CRON
// must be "on") — the same explicit-opt-in convention as everything else in
// this codebase that can fire a real outbound request (alerts' webhooks,
// drift's upstream probes): a container that starts up must never begin
// sending real traffic to the internet as a side effect nobody asked for.
//
// Deliberately a plain setInterval, not node-cron's cron-expression parser:
// the plan names node-cron, but "run the sweep every N minutes" is what
// self-hosting actually needs operationally here — nothing schedules this to
// fire at a specific wall-clock time — and setInterval needs no new
// dependency. If genuine cron-expression scheduling is ever wanted, this
// file's internals are the only thing that has to change.
import { sweepAllAlerts } from "../alerts/evaluate";
import { sweepAllDrift } from "../drift/run";
import { getRuntimeStore } from "../store/runtime-source";
import { selfHostAfter } from "./after";

const DEFAULT_INTERVAL_MS = 5 * 60_000;

export interface SelfHostCronOptions {
  intervalMs?: number;
  onLog?: (line: string) => void;
}

async function sweepOnce(log: (line: string) => void): Promise<void> {
  const store = await getRuntimeStore();
  const [alertResults, driftResults] = await Promise.all([sweepAllAlerts(store), sweepAllDrift(store)]);
  const firing = alertResults.filter((r) => r.firing).length;
  const findings = driftResults.reduce((n, r) => n + r.findingsCount, 0);
  log(
    `[self-host cron] swept ${alertResults.length} alert(s) (${firing} firing), ` +
      `${driftResults.length} drift-enabled project(s) (${findings} finding(s))`,
  );
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Returns a stop function. Starting twice in the same process is a
 *  no-op on the second call — instrumentation.ts's register() can run more
 *  than once under some Next.js runtimes, and this must not double the
 *  sweep rate (double the outbound webhook/probe traffic) if it does. */
export function startSelfHostCron(opts: SelfHostCronOptions = {}): () => void {
  if (timer) return () => {};
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const log = opts.onLog ?? ((line: string) => console.log(line));

  timer = setInterval(() => {
    selfHostAfter(() => sweepOnce(log));
  }, intervalMs);
  timer.unref(); // a pending sweep must never keep the process alive on its own

  log(`[self-host cron] started, sweeping every ${intervalMs}ms`);
  return () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };
}

/** Test hook. */
export function __resetSelfHostCron(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
