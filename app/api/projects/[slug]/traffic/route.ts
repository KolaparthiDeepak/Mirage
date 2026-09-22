// Plan 05: GET /api/projects/:slug/traffic — the table, the live tail
// (?since=) and the unmatched inbox (?matched=false) all go through this one
// endpoint, differing only by which query params they pass.
import { getRuntimeStore } from "@/src/store/runtime-source";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const STATUS_CLASS_RANGES: Record<string, [number, number]> = {
  "2xx": [200, 299],
  "3xx": [300, 399],
  "4xx": [400, 499],
  "5xx": [500, 599],
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const q = url.searchParams;

  const limit = Math.min(Number(q.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT);
  const matched = q.get("matched");
  const statusClass = q.get("status");
  const range = statusClass ? STATUS_CLASS_RANGES[statusClass] : undefined;

  try {
    const store = await getRuntimeStore();
    const rows = await store.queryTraffic({
      slug,
      limit,
      before: q.get("before") ?? undefined,
      since: q.get("since") ?? undefined,
      unmatchedOnly: matched === "false" ? true : matched === "true" ? false : undefined,
      method: q.get("method") ?? undefined,
      ruleId: q.get("rule") ?? undefined,
      pathContains: q.get("path") ?? undefined,
      statusFrom: range?.[0],
      statusTo: range?.[1],
    });
    const nextCursor = rows.length > 0 ? rows[rows.length - 1]!.at : null;
    return Response.json({ rows, nextCursor });
  } catch (e) {
    console.error(`[traffic] query failed for "${slug}": ${(e as Error).message}`);
    return Response.json({ error: "traffic query failed" }, { status: 503 });
  }
}
