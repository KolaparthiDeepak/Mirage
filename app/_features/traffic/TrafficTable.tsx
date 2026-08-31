import { EmptyState } from "@/app/_ui";
import type { TrafficEntry } from "./sample-traffic";
import { TrafficRow } from "./TrafficRow";
import styles from "./traffic.module.css";

type Props = {
  entries: TrafficEntry[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

export function TrafficTable({ entries, selectedId, onSelect }: Props) {
  if (entries.length === 0) {
    return <EmptyState title="No traffic" body="Sample log is empty." />;
  }

  return (
    <div className={styles.scroll} style={{ overflowX: "auto" }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Status</th>
            <th>Time</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <TrafficRow
              key={entry.id}
              entry={entry}
              selected={entry.id === selectedId}
              onSelect={() => onSelect?.(entry.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
