// Plan 02 rollout step 4 — scoped to the mock route only (see the equivalence
// test and the design doc for why the app layout/ViewModel side is a separate,
// larger follow-up: it needs a list-then-compile-every-project path that
// doesn't exist yet, not a single-slug lookup).
//
// `getConfig()` (store mode) and `getFilesBundle()` (files mode, plan 20) are
// reached via dynamic import, not a static one: the store drivers pull in
// native/heavy deps (better-sqlite3, postgres.js), and files mode pulls in
// @apidevtools/swagger-parser via the compiler. A dynamic import means
// neither is ever loaded unless the corresponding config source is actually
// selected. `getRuntimeStore` itself now lives in runtime-store.ts (re-
// exported below) — self-host-cron.ts (plan 20) needs a Store and nothing
// else, and must never transitively reach this file's files-mode branch or
// the compiler behind it; see runtime-store.ts's own comment for why.
import bundleJson from "@/mocks.generated.json";
import type { CompiledBundle } from "../compile/compile";
import type { ProjectConfig } from "../engine/types";
import type { ConfigResult } from "./config-cache";
import { getRuntimeStore } from "./runtime-store";

export { getRuntimeStore } from "./runtime-store";

const bundle = bundleJson as unknown as CompiledBundle;

export function configSource(): "store" | "bundle" | "files" {
  if (process.env.MIRAGE_CONFIG_SOURCE === "store") return "store";
  // Plan 20 — self-host CI mode: MIRAGE_MOCKS_DIR without MIRAGE_CONFIG_SOURCE=files
  // set would silently do nothing, which is a worse failure mode than
  // inferring the mode from the one env var that only ever makes sense here.
  if (process.env.MIRAGE_CONFIG_SOURCE === "files" || process.env.MIRAGE_MOCKS_DIR) return "files";
  return "bundle";
}

export async function getStoreConfig(slug: string): Promise<ConfigResult | null> {
  const [store, { getConfig }] = await Promise.all([getRuntimeStore(), import("./config-cache")]);
  return getConfig(store, slug);
}

export interface CurrentConfig {
  config: ProjectConfig;
  /** null for a bundle-sourced project — no version concept within one
   *  deploy's lifetime (see the mock route's getProject). */
  configVersion: number | null;
}

/** The one place that resolves "what config answers requests for this slug
 *  right now" — used by the mock route and by the match-trace endpoint (plan
 *  06), so they can never disagree about which project a slug names. */
export async function getCurrentConfig(slug: string): Promise<CurrentConfig | undefined> {
  const source = configSource();
  if (source === "store") {
    const result = await getStoreConfig(slug);
    return result ? { config: result.config, configVersion: result.version } : undefined;
  }
  if (source === "files") {
    // Dynamic import for the same reason createStore() is (see the top of
    // this file): compileMocks pulls in @apidevtools/swagger-parser, which
    // has no business loading into a deploy that never sets MIRAGE_MOCKS_DIR.
    const { getFilesBundle } = await import("./files-source");
    const filesBundle = await getFilesBundle(process.env.MIRAGE_MOCKS_DIR ?? "mocks");
    const config = filesBundle.projects[slug];
    return config ? { config, configVersion: null } : undefined;
  }
  const config = bundle.projects[slug];
  return config ? { config, configVersion: null } : undefined;
}
