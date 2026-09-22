// Plan 07 — "Test connection": one validated GET to the upstream root, so the
// operator can confirm the URL works before flipping the mode on. Same SSRF
// gate as a save; nothing is stored and nothing is recorded.
import { upstreamSchema } from "@/src/compile/schema";
import { forwardToUpstream } from "@/src/proxy/forward";
import { assertSafeUpstreamUrl, UpstreamError } from "@/src/proxy/ssrf";
import { checkAdminAuth } from "../../../../_lib/admin-auth";

export async function POST(req: Request): Promise<Response> {
  const authError = checkAdminAuth(req);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }

  const shape = upstreamSchema.pick({ url: true, forwardAuth: true, timeoutMs: true }).safeParse(body);
  if (!shape.success) {
    return Response.json({ error: shape.error.issues[0]!.message }, { status: 400 });
  }

  let url: URL;
  try {
    url = await assertSafeUpstreamUrl(shape.data.url);
  } catch (e) {
    if (e instanceof UpstreamError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const result = await forwardToUpstream({
    targetUrl: url,
    method: "GET",
    reqHeaders: {},
    body: null,
    forwardAuth: shape.data.forwardAuth ?? false,
    timeoutMs: shape.data.timeoutMs ?? 5000,
  });

  if (result.error) {
    return Response.json({ ok: false, error: `upstream ${result.error}` }, { status: 200 });
  }
  return Response.json({ ok: true, status: result.status }, { status: 200 });
}
