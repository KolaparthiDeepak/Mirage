// Plan 06's "Surfaces" list: GET /api/projects/:slug/traffic/:id/trace, for
// the traffic detail view (plan 05) and for CLI/CI use (plan 19). Replays the
// stored request through explain() against the *current* project config.
//
// This is a deliberate, disclosed gap: explain() should ideally run against
// the config version that actually served the request (plan 04's
// configVersion field exists for exactly this), but replaying against a past
// version needs config history/snapshots (plan 15), which doesn't exist yet.
// staleConfig on the response says so plainly rather than silently pretending
// the trace reflects a version that may no longer exist.
import { explain } from "@/src/engine/explain";
import type { ParsedRequest } from "@/src/engine/types";
import { getCurrentConfig, getRuntimeStore } from "@/src/store/runtime-source";

function toParsedRequest(row: { method: string; path: string; query: Record<string, string>; reqHeaders: Record<string, string>; reqBody: string | null }): ParsedRequest {
  const rawBody = row.reqBody ?? "";
  let body: unknown;
  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = undefined;
    }
  }
  return { method: row.method, path: row.path, headers: row.reqHeaders, query: row.query, body, rawBody };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  const { slug, id } = await ctx.params;
  try {
    const [store, current] = await Promise.all([getRuntimeStore(), getCurrentConfig(slug)]);
    if (!current) return Response.json({ error: "unknown project", slug }, { status: 404 });

    const [row] = await store.queryTraffic({ slug, id, limit: 1 });
    if (!row) return Response.json({ error: "not found" }, { status: 404 });

    // reqBody/reqHeaders may already carry "***" from redaction (plan 04) —
    // explain() just sees whatever text is there, same as any other value;
    // a redacted jsonPath target will legitimately fail a condition that
    // depended on the real value, and that is the correct, honest trace.
    const result = explain(toParsedRequest(row), current.config);

    const staleConfig =
      row.configVersion != null && current.configVersion != null && row.configVersion !== current.configVersion;

    return Response.json({
      ...result,
      staleConfig,
      note: staleConfig
        ? `this project's config has changed since this request was served (was v${row.configVersion}, now v${current.configVersion}) — the trace reflects the current rules, not the ones that actually answered`
        : undefined,
    });
  } catch (e) {
    console.error(`[traffic] trace failed for "${slug}"/"${id}": ${(e as Error).message}`);
    return Response.json({ error: "trace failed" }, { status: 503 });
  }
}
