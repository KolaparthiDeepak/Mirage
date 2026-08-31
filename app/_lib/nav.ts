// Deep-link URL builders shared by GlobalSearch and CommandPalette. Slugs are
// repo-authored directory names; endpoint keys and case ids can contain spaces
// and slashes, so they are always encoded.

export function projectHref(slug: string): string {
  return `/p/${slug}`;
}

export function endpointHref(slug: string, key: string): string {
  return `/p/${slug}/endpoints?e=${encodeURIComponent(key)}`;
}

export function caseHref(slug: string, key: string, caseId: string): string {
  return `${endpointHref(slug, key)}&c=${encodeURIComponent(caseId)}`;
}
