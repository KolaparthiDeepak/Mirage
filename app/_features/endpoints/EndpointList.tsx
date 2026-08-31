"use client";
import type { KeyboardEvent } from "react";
import type { EndpointVM } from "@/src/viewer/model";
import { EndpointRow } from "./EndpointRow";
import styles from "./endpoints.module.css";

export function EndpointList({
  endpoints,
  selectedKey,
  onSelect,
}: {
  endpoints: EndpointVM[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  // Salvaged from _explorer/EndpointList.tsx: ArrowUp/Down select the sibling row and focus it.
  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const rows = Array.from(ev.currentTarget.children) as HTMLElement[];
    const i = rows.indexOf(ev.target as HTMLElement);
    if (i === -1) return;
    ev.preventDefault();
    const j = i + (ev.key === "ArrowDown" ? 1 : -1);
    const next = endpoints[j];
    if (!next) return;
    onSelect?.(next.key);
    rows[j]?.focus();
  }

  return (
    <div role="listbox" aria-label="Endpoints" className={styles.list} onKeyDown={onKeyDown}>
      {/* ponytail: linear render — card-block-lost has <40 cases; add windowing only past ~200 rows. */}
      {endpoints.map((e, i) => (
        <EndpointRow
          key={e.key}
          endpoint={e}
          selected={e.key === selectedKey}
          tabbable={e.key === selectedKey || (selectedKey == null && i === 0)}
          onSelect={() => onSelect?.(e.key)}
        />
      ))}
    </div>
  );
}
