"use client";
// Plan 23: "Try a sample" — a small, real project someone can immediately
// break and fix, not a guided tour. Covers the four things the plan calls
// out: three endpoints, one match condition, one templated response, and one
// intentional unmatched example (calling GET /status without X-Debug hits
// notFound — a first, safe encounter with rule matching and explain()).
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";

const SAMPLE_RULES = [
  {
    id: "get-user-by-id",
    request: { method: "GET" as const, path: "/users/:id" },
    response: { status: 200, body: { id: "{{request.path.id}}", name: "Ada Lovelace" } },
  },
  {
    id: "post-users-ok",
    request: { method: "POST" as const, path: "/users" },
    response: { status: 201, body: { created: true } },
  },
  {
    id: "get-status-debug",
    // Only matches with the header set — plain `GET /status` intentionally
    // 404s, so the sample project comes with its own broken example.
    request: {
      method: "GET" as const,
      path: "/status",
      match: [{ header: "X-Debug", equals: "1" }],
    },
    response: { status: 200, body: { debug: true, uptime: 9001 } },
  },
];

export type SampleResult = { ok: true; slug: string } | { ok: false; error: string };

async function errorFrom(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createSampleProject(): Promise<SampleResult> {
  try {
    let slug = "sample-api";
    let res = await adminFetch("/api/projects", { method: "POST", json: { name: "Sample API", slug } });
    if (res.status === 409) {
      slug = `sample-api-${Date.now().toString(36)}`;
      res = await adminFetch("/api/projects", { method: "POST", json: { name: "Sample API", slug } });
    }
    if (!res.ok) return { ok: false, error: await errorFrom(res, `create failed (${res.status})`) };

    for (const rule of SAMPLE_RULES) {
      const r = await adminFetch(`/api/projects/${slug}/rules`, { method: "POST", json: rule });
      if (!r.ok) return { ok: false, error: await errorFrom(r, `rule "${rule.id}" failed (${r.status})`) };
    }
    return { ok: true, slug };
  } catch (e) {
    return { ok: false, error: e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e) };
  }
}
