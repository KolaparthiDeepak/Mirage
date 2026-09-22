// Extracted out of runtime-source.ts (2026-09-22): this file's only job is
// the lazy Store singleton, with zero connection to config resolution
// (getCurrentConfig, files-source.ts, compile.ts) — self-host-cron.ts
// (reached from instrumentation.ts, plan 20) needs a Store and nothing else,
// and must never transitively reach @apidevtools/swagger-parser (via
// files-source.ts -> compile.ts -> openapi/expand.ts) the way importing
// anything from runtime-source.ts would. See src/compile/to-route.ts's
// comment for the fuller story — this is the same class of fix for a
// different edge in the same graph: dynamic import() does not reliably
// code-split Next's instrumentation entry point the way it does a per-route
// serverless function, so the only real fix is not having the edge at all.
//
// runtime-source.ts re-exports getRuntimeStore from here, so every other
// existing caller is unaffected.
import type { Store } from "./types";

let lazyStore: Store | undefined;

/** The one place both the config path and the traffic-recording path (plan
 *  04) get a Store instance from — both need it independently of each other
 *  (traffic recording works even when config is bundle-sourced), so both
 *  route through this lazy singleton rather than each constructing their own.
 *  Dynamic import: SqliteStore pulls in better-sqlite3, a native addon, and
 *  PostgresStore pulls in postgres.js. Statically importing either here
 *  would bundle a native module into every deploy that reaches this file
 *  even when nothing ever calls this function. */
export async function getRuntimeStore(): Promise<Store> {
  const { createStore } = await import("./index");
  if (!lazyStore) lazyStore = createStore();
  return lazyStore;
}
