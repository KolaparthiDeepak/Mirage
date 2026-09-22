"use client";
import type { KeyboardEvent } from "react";
import type { CaseVM } from "@/src/viewer/model";
import { CaseRow } from "./CaseRow";
import styles from "./cases.module.css";

export function CaseList({
  cases,
  selectedId,
  onSelect,
  slug,
  method,
  path,
  onChanged,
}: {
  cases: CaseVM[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Needed for the row actions (duplicate/delete) — omit to render read-only. */
  slug?: string;
  method?: string;
  path?: string;
  onChanged?: () => void;
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
      {/* ponytail: linear render — card-block-lost has <40 cases; add windowing only past ~200 rows. */}
      {cases.map((c, i) => (
        <CaseRow
          key={c.id}
          case_={c}
          selected={c.id === selectedId}
          tabbable={c.id === selectedId || (selectedId == null && i === 0)}
          onSelect={() => onSelect?.(c.id)}
          slug={slug}
          method={method}
          path={path}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
