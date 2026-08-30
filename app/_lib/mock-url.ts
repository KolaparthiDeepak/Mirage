// The mock server is served from the same origin as the app (app/m/[...slug]/route.ts).

// Origin-free, SSR-stable form for display (server and client render the same string).
export function mockPath(slug: string, basePath?: string): string {
  return `/m/${slug}${basePath ?? ""}`;
}

// Absolute form for copying. Resolve at click time on the client so `origin` is real.
export function mockBaseUrl(
  slug: string,
  basePath?: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
): string {
  return `${origin}${mockPath(slug, basePath)}`;
}
