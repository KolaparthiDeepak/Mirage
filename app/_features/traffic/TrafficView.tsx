"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button, Input, Select } from "@/app/_ui";
import { useTraffic, type TrafficQuery } from "@/app/_lib/use-traffic";
import { useDebounced } from "@/app/_lib/use-debounced";
import { buildHar } from "./har";
import { TrafficTable } from "./TrafficTable";
import { TrafficDrawer } from "./TrafficDrawer";
import styles from "./traffic.module.css";

function download(filename: string, data: unknown, mimeType: string) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export function TrafficView({
  slugs,
  exportName,
}: {
  slugs: string[];
  exportName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters live in the URL (plan 05) — the same pattern EndpointWorkspace
  // uses for ?e=/?c=, so a filtered view is a shareable link.
  const query: TrafficQuery = {
    method: searchParams.get("method") ?? "",
    status: (searchParams.get("status") as TrafficQuery["status"]) ?? "",
    matched: (searchParams.get("matched") as TrafficQuery["matched"]) ?? "",
    path: searchParams.get("path") ?? "",
  };
  const [pathInput, setPathInput] = useState(query.path ?? "");
  const debouncedPath = useDebounced(pathInput, 200);
  const [live, setLive] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);

  const effectiveQuery = useMemo(
    (): TrafficQuery => ({ method: query.method, status: query.status, matched: query.matched, path: debouncedPath }),
    [query.method, query.status, query.matched, debouncedPath],
  );
  const { rows, loading } = useTraffic(slugs, effectiveQuery, live);

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const selected = rows.find((r) => r.id === selId) ?? null;

  return (
    <>
      <div className={styles.toolbar}>
        <Input
          aria-label="Search traffic"
          placeholder="Filter by path…"
          value={pathInput}
          onChange={(e) => {
            setPathInput(e.target.value);
            setParam("path", e.target.value);
          }}
        />
        <Select aria-label="Filter by method" value={query.method} onChange={(e) => setParam("method", e.target.value)}>
          <option value="">All methods</option>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={query.status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option>
          {["2xx", "3xx", "4xx", "5xx"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select aria-label="Filter by matched" value={query.matched} onChange={(e) => setParam("matched", e.target.value)}>
          <option value="">Matched + unmatched</option>
          <option value="false">Unmatched only</option>
          <option value="true">Matched only</option>
        </Select>
        <Button
          variant={live ? "primary" : "secondary"}
          onClick={() => setLive((v) => !v)}
          aria-pressed={live}
        >
          {live ? "● Live" : "Paused"}
        </Button>
        <Button className={styles.toolbarEnd} variant="secondary" onClick={() => download(exportName, rows, "application/json")}>
          Export JSON
        </Button>
        <Button variant="secondary" onClick={() => download(exportName.replace(/\.json$/, ".har"), buildHar(rows), "application/json")}>
          Export HAR
        </Button>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <TrafficTable entries={rows} selectedId={selId} onSelect={setSelId} />
      )}
      <TrafficDrawer entry={selected} open={selected != null} onClose={() => setSelId(null)} />
    </>
  );
}
