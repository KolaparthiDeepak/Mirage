"use client";
import { useMemo, useState } from "react";
import { useViewModel } from "@/app/_lib/view-model-context";
import { useDebounced } from "@/app/_lib/use-debounced";
import { Button, Input, Select } from "@/app/_ui";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { sampleTraffic } from "@/app/_features/traffic/sample-traffic";
import { TrafficTable } from "@/app/_features/traffic/TrafficTable";
import { TrafficDrawer } from "@/app/_features/traffic/TrafficDrawer";
import styles from "@/app/_features/traffic/traffic.module.css";

export default function WorkspaceTrafficPage() {
  const model = useViewModel();

  const all = useMemo(
    () =>
      model.projects.flatMap((p) =>
        sampleTraffic(p).map((entry) => ({ entry, project: p })),
      ),
    [model],
  );
  const methods = useMemo(
    () => Array.from(new Set(all.map((r) => r.entry.method))),
    [all],
  );

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const q = useDebounced(search, 150).trim().toLowerCase();

  const filtered = useMemo(
    () =>
      all.filter(({ entry }) => {
        if (method && entry.method !== method) return false;
        if (!q) return true;
        return (
          entry.path.toLowerCase().includes(q) ||
          entry.method.toLowerCase().includes(q) ||
          String(entry.status).includes(q)
        );
      }),
    [all, method, q],
  );

  function exportJson() {
    const blob = new Blob([JSON.stringify(all.map((r) => r.entry), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspace-traffic-sample.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const selected = filtered.find((r) => r.entry.id === selId) ?? null;

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Sample request log across all projects — the mock backend does not record traffic yet."
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

      <TrafficTable
        entries={filtered.map((r) => r.entry)}
        selectedId={selId}
        onSelect={setSelId}
      />
      <TrafficDrawer
        entry={selected?.entry ?? null}
        project={selected?.project ?? null}
        open={selId != null}
        onClose={() => setSelId(null)}
      />
    </>
  );
}
