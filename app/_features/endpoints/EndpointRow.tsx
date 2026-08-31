"use client";
import type { KeyboardEvent } from "react";
import type { EndpointVM } from "@/src/viewer/model";
import { MethodPill } from "@/app/_ui";
import { commandCode } from "@/app/_lib/endpoint-label";
import styles from "./endpoints.module.css";

export function EndpointRow({
  endpoint,
  selected,
  tabbable = selected,
  onSelect,
}: {
  endpoint: EndpointVM;
  selected?: boolean;
  /** Roving-tabindex: true makes this the list's tab stop. Defaults to `selected`. */
  tabbable?: boolean;
  onSelect?: () => void;
}) {
  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.target !== ev.currentTarget) return; // ignore keys from nested controls
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelect?.();
    }
    // ArrowUp/Down handled at the list level (needs sibling keys) — see EndpointList.
  }

  return (
    <div
      role="option"
      tabIndex={tabbable ? 0 : -1}
      aria-selected={!!selected}
      className={styles.row}
      onClick={() => onSelect?.()}
      onKeyDown={onKeyDown}
    >
      <MethodPill method={endpoint.method} />
      <span className={styles.labels} title={endpoint.summary}>
        <span className={styles.code}>{commandCode(endpoint.path)}</span>
        <span className={styles.sub}>{endpoint.summary ?? endpoint.path}</span>
      </span>
      <span className={styles.meta}>{endpoint.cases.length} cases</span>
    </div>
  );
}
