"use client";
import { useMemo, useState } from "react";
import { useDebounced } from "@/app/_lib/use-debounced";
import { Button, Input, Select } from "@/app/_ui";
import type { ProjectVM } from "@/src/viewer/model";
import type { TrafficEntry } from "./types";
import { TrafficTable } from "./TrafficTable";
import { TrafficDrawer } from "./TrafficDrawer";
import styles from "./traffic.module.css";

export type TrafficRowVM = { entry: TrafficEntry; project: ProjectVM };

export function TrafficView({
  rows,
  exportName,
}: {
  rows: TrafficRowVM[];
  exportName: string;
}) {
  const methods = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entry.method))),
    [rows],
  );

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const q = useDebounced(search, 150).trim().toLowerCase();

  const filtered = useMemo(
    () =>
      rows.filter(({ entry }) => {
        if (method && entry.method !== method) return false;
        if (!q) return true;
        return (
          entry.path.toLowerCase().includes(q) ||
          entry.method.toLowerCase().includes(q) ||
          String(entry.status).includes(q)
        );
      }),
    [rows, method, q],
  );

  function exportJson() {
    const payload = rows.map((r) => ({ ...r.entry, project: r.project.slug }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  // Look the selection up in the full list, not `filtered`, so filtering the
  // selected row out of the table doesn't leave the drawer open with no content.
  const selected = rows.find((r) => r.entry.id === selId) ?? null;

  return (
    <>
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
        <Button
          className={styles.toolbarEnd}
          variant="secondary"
          onClick={exportJson}
        >
          Export
        </Button>
      </div>

      <TrafficTable
        entries={filtered.map((r) => r.entry)}
        selectedId={selId}
        onSelect={setSelId}
      />
      <TrafficDrawer
        entry={selected?.entry ?? null}
        project={selected?.project ?? null}
        open={selected != null}
        onClose={() => setSelId(null)}
      />
    </>
  );
}
