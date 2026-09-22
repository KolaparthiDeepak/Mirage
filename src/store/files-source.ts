// Plan 20 — CI/self-host "mount a repo, no database" mode:
// MIRAGE_CONFIG_SOURCE=files compiles mocks/** at runtime instead of reading
// mocks.generated.json (the build-time bundle baked into the image) or the
// store. This is what makes `docker run -v ./mocks:/mocks:ro` work without a
// rebuild for every mock change.
//
// Read-only by construction, not by a special-cased guard: every write route
// checks `store.getProject(slug)` first, and a files-mode project was never
// saved to the store, so that check already 404s "unknown project" before
// any write logic runs. Nothing extra needed here for that.
import { compileMocks } from "../compile/compile";
import type { CompiledBundle } from "../compile/compile";

// Short TTL: a mounted repo can change between two requests in the exact
// scenario this mode exists for (a CI step editing mocks between test runs
// against the same long-lived container) — unlike the store's config-cache
// (plan 02), which caches for 5s because a save always goes through the same
// process and can invalidate its own cache, there is no save event here to
// invalidate on, so the cache just has to be short.
const TTL_MS = 2000;

let cache: { bundle: CompiledBundle; at: number } | undefined;

/** Same "stale beats a 503" rule as config-cache.ts's store-read-error path:
 *  a compile error keeps serving the last good bundle rather than 404ing
 *  every project because of one bad file, and logs loudly either way. */
export async function getFilesBundle(mocksDir: string): Promise<CompiledBundle> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.bundle;

  const result = await compileMocks(mocksDir, "self-host");
  if (result.errors.length > 0) {
    console.error(`[files-source] compile error(s) in "${mocksDir}":\n  ${result.errors.join("\n  ")}`);
    if (cache) {
      cache = { bundle: cache.bundle, at: now };
      return cache.bundle;
    }
    // Nothing to fall back to yet — the errored (possibly partial) bundle is
    // the only thing there is; every project it fails to name 404s.
  }
  cache = { bundle: result.bundle, at: now };
  return cache.bundle;
}

/** Test hook. */
export function __resetFilesCache(): void {
  cache = undefined;
}
