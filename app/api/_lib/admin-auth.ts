// Plan 03: "Unauthenticated write endpoints must not ship even for one
// deploy." A single shared secret until plan 14 replaces this with real
// per-user auth. Every write route calls this first and returns its result
// directly on failure.
export function checkAdminAuth(req: Request): Response | null {
  const configured = process.env.MIRAGE_ADMIN_TOKEN;
  if (!configured) {
    // No token configured at all: refuse every write rather than silently
    // allowing them — an operator who forgot to set the token should see
    // writes fail loudly, not discover they were wide open.
    return Response.json({ error: "MIRAGE_ADMIN_TOKEN is not configured; writes are disabled" }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== configured) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
