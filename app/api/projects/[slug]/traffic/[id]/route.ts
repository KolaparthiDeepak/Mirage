// Plan 05: GET /api/projects/:slug/traffic/:id — one row, for the detail
// drawer (lazy-loaded on expand, per plan 05's risk table: "large bodies
// bloat the detail view" is avoided by never fetching bodies in the list query).
import { getRuntimeStore } from "@/src/store/runtime-source";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  const { slug, id } = await ctx.params;
  try {
    const store = await getRuntimeStore();
    const [row] = await store.queryTraffic({ slug, id, limit: 1 });
    if (!row) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(row);
  } catch (e) {
    console.error(`[traffic] detail fetch failed for "${slug}"/"${id}": ${(e as Error).message}`);
    return Response.json({ error: "traffic query failed" }, { status: 503 });
  }
}
