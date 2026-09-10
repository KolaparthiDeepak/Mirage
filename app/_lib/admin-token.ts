"use client";
// Plan 03: write endpoints are gated by MIRAGE_ADMIN_TOKEN, a server-side
// secret. It must never be baked into the JS bundle (a NEXT_PUBLIC_ env var
// would ship it to every visitor) — instead the operator pastes it once into
// their own browser (AdminTokenModal), stored in localStorage, sent as a
// bearer token from then on. This is exactly the "single shared secret until
// plan 14 replaces this with real per-user auth" the plan describes; a
// real login screen is plan 14's job, not this one's.
const KEY = "mirage-admin-token";

export function getAdminToken(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* private mode / storage disabled */
  }
}

export class AdminAuthError extends Error {
  constructor(public status: number) {
    super(status === 401 ? "Admin token missing or incorrect." : "Writes are disabled — no admin token is configured on the server.");
  }
}

/** fetch() with the admin bearer token attached, JSON body/response assumed.
 *  Throws AdminAuthError on 401/503 so callers can show one consistent
 *  "set your admin token" prompt instead of each re-implementing it. */
export async function adminFetch(url: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${getAdminToken()}`,
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 || res.status === 503) throw new AdminAuthError(res.status);
  return res;
}
