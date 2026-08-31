"use client";
import type { KeyboardEvent } from "react";
import type { CaseVM } from "@/src/viewer/model";
import { Badge, Dropdown, StatusCode } from "@/app/_ui";
import { statusKind } from "@/app/_lib/status";
import { matchSummary } from "@/app/_lib/match-summary";
import styles from "./cases.module.css";

export function CaseRow({
  case_,
  selected,
  onSelect,
}: {
  case_: CaseVM;
  selected?: boolean;
  onSelect?: () => void;
}) {
  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.target !== ev.currentTarget) return; // ignore keys from nested controls (⋯ menu)
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelect?.();
    }
    // ArrowUp/Down handled at the list level (needs sibling ids) — see CaseList.
  }

  return (
    <div
      role="option"
      tabIndex={selected ? 0 : -1}
      aria-selected={!!selected}
      className={case_.isOpenApiGenerated ? `${styles.row} ${styles.rowGenerated}` : styles.row}
      onClick={() => onSelect?.()}
      onKeyDown={onKeyDown}
    >
      <span className={styles.dot} data-kind={statusKind(case_.expected.status)} />
      <span className={styles.label}>{case_.label}</span>
      <span className={styles.match}>{matchSummary(case_.match)}</span>
      {case_.isOpenApiGenerated ? <Badge tone="neutral">generated</Badge> : null}
      <StatusCode code={case_.expected.status} />
      <span className={styles.overflow} onClick={(e) => e.stopPropagation()}>
        <Dropdown
          trigger={<span aria-label="Case actions">⋯</span>}
          items={[
            { label: "Duplicate", onSelect() {}, disabled: true },
            { label: "Edit", onSelect() {}, disabled: true },
            { label: "Delete", onSelect() {}, disabled: true },
          ]}
        />
      </span>
    </div>
  );
}
