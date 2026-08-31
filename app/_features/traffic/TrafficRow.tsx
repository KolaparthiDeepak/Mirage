import type { KeyboardEvent } from "react";
import { MethodPill, StatusCode } from "@/app/_ui";
import { commandCode } from "@/app/_lib/endpoint-label";
import type { TrafficEntry } from "./sample-traffic";
import styles from "./traffic.module.css";

type Props = { entry: TrafficEntry; selected?: boolean; onSelect?: () => void };

export function TrafficRow({ entry, selected, onSelect }: Props) {
  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.();
    }
  }

  return (
    <tr
      className={styles.row}
      tabIndex={0}
      aria-selected={!!selected}
      data-selected={selected || undefined}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <td>
        <MethodPill method={entry.method} />
      </td>
      <td className={styles.mono} title={entry.path}>
        {commandCode(entry.path)}
      </td>
      <td>
        <StatusCode code={entry.status} />
      </td>
      <td className={`${styles.muted} ${styles.tabular}`}>{entry.at}</td>
      <td className={styles.tabular}>{entry.ms} ms</td>
    </tr>
  );
}
