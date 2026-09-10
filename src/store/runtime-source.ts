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
import type { ProjectConfig } from "../engine/types";
import type { Store } from "./types";

export function configSource(): "store" | "bundle" {
  return process.env.MIRAGE_CONFIG_SOURCE === "store" ? "store" : "bundle";
}

let lazyStore: Store | undefined;

export async function getStoreConfig(slug: string): Promise<ProjectConfig | null> {
  const [{ createStore }, { getConfig }] = await Promise.all([import("./index"), import("./config-cache")]);
  if (!lazyStore) lazyStore = createStore();
  return getConfig(lazyStore, slug);
}
