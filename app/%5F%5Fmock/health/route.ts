// Do not rename the app/%5F%5Fmock/ folder: Next.js 15 treats any _-prefixed
// folder as private/non-routable, so app/__mock/ would silently 404. The
// URL-encoded %5F%5Fmock name is Next's documented opt-out that keeps
// /__mock/health and /__mock/projects reachable.
//
// Plan 24 — extended with live signals beyond the build-time bundle info
// that was already here: store connectivity, config-cache hit rate, and
// (store mode only) each project's current config version. `ok` stays true
// even when the store is unreachable — that's what /__mock/ready is for;
// health reports state, it doesn't gate a deploy.
import bundleJson from "@/mocks.generated.json";
import type { CompiledBundle } from "@/src/compile/compile";
import { getCacheStats } from "@/src/store/config-cache";
import { configSource, getRuntimeStore } from "@/src/store/runtime-source";

const bundle = bundleJson as unknown as CompiledBundle;

export async function GET(): Promise<Response> {
  const source = configSource();

  let store: { ok: boolean; error?: string } = { ok: true };
  let projectVersions: Record<string, number> | undefined;
  if (source === "store") {
    try {
      const s = await getRuntimeStore();
      const summaries = await s.listProjects();
      projectVersions = Object.fromEntries(summaries.map((p) => [p.slug, p.configVersion]));
    } catch (e) {
      store = { ok: false, error: (e as Error).message };
    }
  }

  return Response.json({
    ok: true,
    service: "mirage",
    builtAt: bundle.builtAt,
    commit: bundle.commit,
    projectCount: Object.keys(bundle.projects).length,
    warnings: bundle.warnings,
    configSource: source,
    store,
    configCache: getCacheStats(),
    ...(projectVersions ? { projectVersions } : {}),
  });
}
