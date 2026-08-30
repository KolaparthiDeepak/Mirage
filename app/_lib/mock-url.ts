// The mock server is served from the same origin as the app (app/m/[...slug]/route.ts).
export function mockBaseUrl(
  slug: string,
  basePath?: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "",
): string {
  return `${origin}/m/${slug}${basePath ?? ""}`;
}
