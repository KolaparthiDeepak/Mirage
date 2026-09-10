"use client";
import type { KeyboardEvent } from "react";
import { EmptyState } from "@/app/_ui";
import type { TrafficEntry } from "@/src/store/types";
import { TrafficRow } from "./TrafficRow";
import styles from "./traffic.module.css";

type Props = {
  entries: TrafficEntry[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

export function TrafficTable({ entries, selectedId, onSelect }: Props) {
  if (entries.length === 0) {
    return <EmptyState title="No traffic" body="No requests recorded yet." />;
  }

  // ArrowUp/Down select the sibling row and move focus (roving tabindex).
  function onKeyDown(ev: KeyboardEvent<HTMLTableSectionElement>) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const rows = Array.from(ev.currentTarget.children) as HTMLElement[];
    const i = rows.indexOf(ev.target as HTMLElement);
    if (i === -1) return;
    ev.preventDefault();
    const j = i + (ev.key === "ArrowDown" ? 1 : -1);
    const next = entries[j];
    if (!next) return;
    onSelect?.(next.id);
    rows[j]?.focus();
  }

  return (
    <div className={styles.scroll} style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Endpoint</th>
            <th scope="col">Status</th>
            <th scope="col">Rule</th>
            <th scope="col">Time</th>
            <th scope="col">Duration</th>
          </tr>
        </thead>
        <tbody onKeyDown={onKeyDown}>
          {entries.map((entry, i) => (
            <TrafficRow
              key={entry.id}
              entry={entry}
              selected={entry.id === selectedId}
              tabbable={entry.id === selectedId || (selectedId == null && i === 0)}
              onSelect={() => onSelect?.(entry.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
