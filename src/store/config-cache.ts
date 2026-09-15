import { toRoute } from "../compile/compile";
import type { ProjectConfig } from "../engine/types";
import type { Store, StoredProject } from "./types";

const TTL_MS = 5_000;

interface CacheEntry {
  config: ProjectConfig;
  version: number;
  at: number;
}

// Module-scope, per plan 02: a cache miss costs one query plus compilation: a
// save is visible everywhere within TTL_MS, worst case — against the ~40s a
// redeploy costs today. Not exported; only getConfig()/invalidate() below
// touch it, so nothing outside this file can bypass the staleness rule.
const cache = new Map<string, CacheEntry>();

export function compileStoredProject(stored: StoredProject): ProjectConfig {
  return {
    name: stored.name,
    slug: stored.slug,
    basePath: stored.basePath,
    defaults: stored.defaults,
    openApiDoc: stored.openApiDoc,
    upstream: stored.upstream,
    faults: stored.faults,
    variables: stored.variables,
    defaultEnvironment: stored.defaultEnvironment,
    contract: stored.contract,
    docs: stored.docs,
    routes: [...stored.rules]
      .sort((a, b) => a.position - b.position)
      .map((r) => toRoute(r.definition)),
  };
}

export interface ConfigResult {
  config: ProjectConfig;
  /** Which stored version produced this config — plan 04: without it, "this
   *  worked an hour ago" is unanswerable once rules become editable. */
  version: number;
}

/**
 * Read-through cache in front of a Store. On a store read error, serves the
 * last good config for that slug **unbounded** (never expires it on error) and
 * logs loudly — plan 02's risk table: "a mock serving hour-old config beats a
 * mock serving 503." If nothing has ever been cached for that slug, there is
 * nothing to fall back to and the error propagates; the caller (the mock
 * route) treats that the same as "unknown project" today.
 */
export async function getConfig(store: Store, slug: string): Promise<ConfigResult | null> {
  const now = Date.now();
  const hit = cache.get(slug);
  if (hit && now - hit.at < TTL_MS) return { config: hit.config, version: hit.version };

  let stored: StoredProject | null;
  try {
    stored = await store.getProject(slug);
  } catch (e) {
    if (hit) {
      console.error(
        `[store] config read failed for "${slug}", serving cached config from ${new Date(hit.at).toISOString()}: ${(e as Error).message}`,
      );
      return { config: hit.config, version: hit.version };
    }
    throw e;
  }

  if (!stored) {
    cache.delete(slug);
    return null;
  }
  const config = compileStoredProject(stored);
  cache.set(slug, { config, version: stored.configVersion, at: now });
  return { config, version: stored.configVersion };
}

/** Called after a save so the instance that served the save doesn't wait out
 *  the TTL. Other instances still rely on the TTL — see plan 02. */
export function invalidateConfig(slug: string): void {
  cache.delete(slug);
}

/** Test-only: force every entry stale regardless of TTL. */
export function clearConfigCache(): void {
  cache.clear();
}
