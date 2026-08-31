"use client";
import { use, useMemo, useState } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { useDebounced } from "@/app/_lib/use-debounced";
import { Button, Input, Select } from "@/app/_ui";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { sampleTraffic } from "@/app/_features/traffic/sample-traffic";
import { TrafficTable } from "@/app/_features/traffic/TrafficTable";
import { TrafficDrawer } from "@/app/_features/traffic/TrafficDrawer";
import styles from "@/app/_features/traffic/traffic.module.css";

export default function TrafficPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const project = useProject(slug)!;

  const all = useMemo(() => sampleTraffic(project), [project]);
  const methods = useMemo(
    () => Array.from(new Set(all.map((e) => e.method))),
    [all],
  );

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const q = useDebounced(search, 150).trim().toLowerCase();

  const filtered = useMemo(
    () =>
      all.filter((e) => {
        if (method && e.method !== method) return false;
        if (!q) return true;
        return (
          e.path.toLowerCase().includes(q) ||
          e.method.toLowerCase().includes(q) ||
          String(e.status).includes(q)
        );
      }),
    [all, method, q],
  );

  function exportJson() {
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-traffic-sample.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  // Search the full list so filtering the selected row out of the table doesn't
  // leave the drawer open with no content.
  const selected = all.find((e) => e.id === selId) ?? null;

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Sample request log — the mock backend does not record traffic yet."
        actions={
          <>
            <PreviewBadge />
            <Button variant="secondary" onClick={exportJson}>
              Export
            </Button>
          </>
        }
      />

      <div className={styles.toolbar}>
        <Input
          aria-label="Search traffic"
          placeholder="Filter by path, method, status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label="Filter by method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="">All methods</option>
          {methods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>

      <TrafficTable entries={filtered} selectedId={selId} onSelect={setSelId} />
      <TrafficDrawer
        entry={selected}
        project={project}
        open={selected != null}
        onClose={() => setSelId(null)}
      />
    </>
  );
}
