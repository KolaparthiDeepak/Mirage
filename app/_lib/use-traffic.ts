"use client";
// Plan 05: fetch + 2s live-tail poll for one or more projects' traffic. Poll
// pauses when the tab is hidden (document.visibilitychange) — polling an
// invisible tab is pure waste. SSE is deliberately not used (plan 05: "polling
// is ~20 lines, survives serverless cold starts, and is trivially debuggable.
// Revisit when someone complains, not before.").
import { useEffect, useRef, useState } from "react";
import type { TrafficEntry } from "@/src/store/types";

export interface TrafficQuery {
  method?: string;
  status?: "2xx" | "3xx" | "4xx" | "5xx" | "";
  matched?: "true" | "false" | "";
  rule?: string;
  path?: string;
}

function toParams(q: TrafficQuery, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (q.method) params.set("method", q.method);
  if (q.status) params.set("status", q.status);
  if (q.matched) params.set("matched", q.matched);
  if (q.rule) params.set("rule", q.rule);
  if (q.path) params.set("path", q.path);
  return params.toString();
}

async function fetchSlug(slug: string, qs: string): Promise<TrafficEntry[]> {
  try {
    const res = await fetch(`/api/projects/${slug}/traffic${qs ? `?${qs}` : ""}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { rows: TrafficEntry[] };
    return body.rows;
  } catch {
    // A network failure here degrades to "no rows shown", not an unhandled
    // rejection — this is a traffic view, not the mock's own response path.
    return [];
  }
}

// Sentinel used when a project has zero traffic yet: distinguishes "haven't
// completed the initial fetch" (real null, poll must wait) from "did fetch,
// found nothing yet" (poll from the beginning of time so the first row that
// ever lands gets picked up — see the bug this fixed, below).
const EPOCH = new Date(0).toISOString();

export function useTraffic(slugs: string[], query: TrafficQuery, live: boolean) {
  const [rows, setRows] = useState<TrafficEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const slugsKey = slugs.join(",");
  const queryKey = JSON.stringify(query);

  // Full refetch whenever the filter or project set changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = toParams(query, { limit: "100" });
    Promise.all(slugs.map((s) => fetchSlug(s, qs))).then((perSlug) => {
      if (cancelled) return;
      const merged = perSlug.flat().sort((a, b) => (a.at < b.at ? 1 : -1));
      setRows(merged);
      // Bug: this used to fall back to `null` when merged was empty, and the
      // poll below treats `null` as "not ready yet" and skips every tick —
      // so a brand-new project with zero traffic never started polling, no
      // matter how long "live" stayed true. EPOCH means "ready, saw nothing
      // yet" instead of "not ready".
      cursorRef.current = merged[0]?.at ?? EPOCH;
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // slugsKey/queryKey are the real dependencies; slugs/query are new array/object identities every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugsKey, queryKey]);

  // Poll for new rows since the newest one currently shown.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    let visible = document.visibilityState === "visible";
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    const id = setInterval(async () => {
      if (!visible || cancelled || !cursorRef.current) return;
      const qs = toParams(query, { since: cursorRef.current, limit: "100" });
      const perSlug = await Promise.all(slugs.map((s) => fetchSlug(s, qs)));
      const fresh = perSlug.flat();
      if (fresh.length === 0 || cancelled) return;
      fresh.sort((a, b) => (a.at < b.at ? 1 : -1)); // newest first, matching the initial fetch
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const toAdd = fresh.filter((r) => !seen.has(r.id));
        return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
      });
      cursorRef.current = fresh[0]!.at;
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, slugsKey, queryKey]);

  return { rows, loading };
}
