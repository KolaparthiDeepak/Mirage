import type { KeyboardEvent } from "react";
import { MethodPill, StatusCode } from "@/app/_ui";
import { commandCode } from "@/app/_lib/endpoint-label";
import type { TrafficEntry } from "@/src/store/types";
import styles from "./traffic.module.css";

type Props = {
  entry: TrafficEntry;
  selected?: boolean;
  /** Roving-tabindex: true makes this the table's tab stop. Defaults to `selected`. */
  tabbable?: boolean;
  onSelect?: () => void;
};

export function TrafficRow({ entry, selected, tabbable = selected, onSelect }: Props) {
  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.();
    }
  }

  return (
    <tr
      className={styles.row}
      tabIndex={tabbable ? 0 : -1}
      aria-current={selected ? "true" : undefined}
      data-selected={selected || undefined}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <td data-label="Method">
        <MethodPill method={entry.method} />
      </td>
      <td className={styles.mono} title={entry.path} data-label="Endpoint">
        {commandCode(entry.path)}
      </td>
      <td data-label="Status">
        <StatusCode code={entry.status} />
      </td>
      <td data-label="Rule">
        {entry.viaUpstream ? (
          <span className={styles.upstreamTag}>upstream</span>
        ) : (
          entry.matchedRuleId ?? <span className={styles.muted}>unmatched</span>
        )}
      </td>
      <td className={`${styles.muted} ${styles.tabular}`} data-label="Time">
        {new Date(entry.at).toLocaleTimeString()}
      </td>
      <td className={styles.tabular} data-label="Duration">{entry.durationMs} ms</td>
    </tr>
  );
}
