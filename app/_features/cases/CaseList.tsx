"use client";
import type { KeyboardEvent } from "react";
import type { CaseVM } from "@/src/viewer/model";
import { CaseRow } from "./CaseRow";
import styles from "./cases.module.css";

export function CaseList({
  cases,
  selectedId,
  onSelect,
}: {
  cases: CaseVM[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  // Salvaged from _explorer/CaseList.tsx: ArrowUp/Down select the sibling row and focus it.
  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const rows = Array.from(ev.currentTarget.children) as HTMLElement[];
    const i = rows.indexOf(ev.target as HTMLElement);
    if (i === -1) return;
    ev.preventDefault();
    const j = i + (ev.key === "ArrowDown" ? 1 : -1);
    const next = cases[j];
    if (!next) return;
    onSelect?.(next.id);
    rows[j]?.focus();
  }

  return (
    <div role="listbox" aria-label="Cases" className={styles.list} onKeyDown={onKeyDown}>
      {cases.map((c, i) => (
        <CaseRow
          key={c.id}
          case_={c}
          selected={c.id === selectedId}
          tabbable={c.id === selectedId || (selectedId == null && i === 0)}
          onSelect={() => onSelect?.(c.id)}
        />
      ))}
    </div>
  );
}
