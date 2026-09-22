// Plan 05: replaces the "—" placeholders on the project overview. Computed
// from a bounded recent window (last 500 rows), not a full-table aggregate —
// enough to be honest without needing dialect-specific percentile SQL that
// would violate plan 02's "never write a query the conformance suite can't
// run on both drivers" rule. Cheap enough not to need the 30s cache the plan
// mentions yet; add one if this page gets busy.
import { getRuntimeStore } from "@/src/store/runtime-source";

const WINDOW = 500;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  try {
    const store = await getRuntimeStore();
    const rows = await store.queryTraffic({ slug, limit: WINDOW });

    const matched = rows.filter((r) => r.matchedRuleId !== null).length;
    const unmatched = rows.length - matched;
    const statusClasses = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 };
    for (const r of rows) {
      const cls = `${Math.floor(r.status / 100)}xx` as keyof typeof statusClasses;
      if (cls in statusClasses) statusClasses[cls]++;
      else statusClasses.other++;
    }
    const durations = rows.map((r) => r.durationMs).sort((a, b) => a - b);

    const unmatchedPathCounts = new Map<string, number>();
    for (const r of rows) {
      if (r.matchedRuleId !== null) continue;
      unmatchedPathCounts.set(r.path, (unmatchedPathCounts.get(r.path) ?? 0) + 1);
    }
    const topUnmatchedPaths = [...unmatchedPathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));

    return Response.json({
      windowSize: rows.length,
      total: rows.length,
      matched,
      unmatched,
      statusClasses,
      p50DurationMs: percentile(durations, 50),
      p95DurationMs: percentile(durations, 95),
      topUnmatchedPaths,
    });
  } catch (e) {
    console.error(`[traffic] stats failed for "${slug}": ${(e as Error).message}`);
    return Response.json({ error: "stats query failed" }, { status: 503 });
  }
}
