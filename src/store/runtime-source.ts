// Plan 02 rollout step 4 — scoped to the mock route only (see the equivalence
// test and the design doc for why the app layout/ViewModel side is a separate,
// larger follow-up: it needs a list-then-compile-every-project path that
// doesn't exist yet, not a single-slug lookup).
//
// `createStore()`/`getConfig()` are reached via dynamic import, not a static
// one: SqliteStore pulls in better-sqlite3, a native addon, and PostgresStore
// pulls in postgres.js. Statically importing either into the mock route would
// bundle a native module into every deploy of this function even when the
// flag is at its default "bundle" — a real risk on Vercel, not just bundle
// bloat. A dynamic import means neither is ever loaded unless someone
// actually sets MIRAGE_CONFIG_SOURCE=store.
import type { Store } from "./types";
import type { ConfigResult } from "./config-cache";

export function configSource(): "store" | "bundle" {
  return process.env.MIRAGE_CONFIG_SOURCE === "store" ? "store" : "bundle";
}

let lazyStore: Store | undefined;

/** The one place both the config path and the traffic-recording path (plan
 *  04) get a Store instance from — both need it independently of each other
 *  (traffic recording works even when config is bundle-sourced), so both
 *  route through this lazy singleton rather than each constructing their own. */
export async function getRuntimeStore(): Promise<Store> {
  const { createStore } = await import("./index");
  if (!lazyStore) lazyStore = createStore();
  return lazyStore;
}

export async function getStoreConfig(slug: string): Promise<ConfigResult | null> {
  const [store, { getConfig }] = await Promise.all([getRuntimeStore(), import("./config-cache")]);
  return getConfig(store, slug);
}
