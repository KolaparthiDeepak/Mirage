// Plan 03's missing piece, flagged (not silently skipped) when plan 02 step 4
// scoped its flag-flip to the mock route only: a project created through the
// browser-authoring API exists in the store and is servable at its live URL,
// but the ViewModel that drives every list, sidebar and search in the app
// (buildViewModel(bundle)) was built once from the static bundle — a new
// store-native project would be invisible in the UI, even though writes to it
// succeed. This fills that gap for store-native projects specifically.
//
// Repo-managed (source: "repo") projects are deliberately left to the bundle
// exactly as before — merging them too risks showing a stale or duplicate
// copy if sync-cli hasn't run in this deployment. Only projects created
// natively in the store (which cannot exist in the bundle at all) are added.
import type { CompiledBundle } from "../compile/compile";
import { compileStoredProject } from "./config-cache";
import { getRuntimeStore } from "./runtime-source";

export async function withStoreProjects(bundle: CompiledBundle): Promise<CompiledBundle> {
  try {
    const store = await getRuntimeStore();
    const summaries = await store.listProjects();
    const storeOnly = summaries.filter((s) => s.source === "store" && !(s.slug in bundle.projects));
    if (storeOnly.length === 0) return bundle;

    const fetched = await Promise.all(storeOnly.map((s) => store.getProject(s.slug)));
    const projects = { ...bundle.projects };
    for (const stored of fetched) {
      if (stored) projects[stored.slug] = compileStoredProject(stored);
    }
    return { ...bundle, projects };
  } catch (e) {
    // The viewer must never fail to render because the store is unreachable —
    // same rule as the mock route's own store-read fallback (plan 02).
    console.error(`[store] could not load store-native projects for the viewer: ${(e as Error).message}`);
    return bundle;
  }
}
