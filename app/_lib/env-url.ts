// app/_lib/env-url.ts — pure URL rebasing for the preview environment switcher. No `window`.

/** Rebase `url` onto `env.baseUrl`. Absolute URLs keep path+search+hash; relative URLs are prefixed. */
export function applyEnv(url: string, env: { baseUrl: string }): string {
  const base = env.baseUrl.replace(/\/+$/, "");
  if (/^https?:\/\//.test(url)) {
    const u = new URL(url);
    return base + u.pathname + u.search + u.hash;
  }
  return base + (url.startsWith("/") ? "" : "/") + url;
}
