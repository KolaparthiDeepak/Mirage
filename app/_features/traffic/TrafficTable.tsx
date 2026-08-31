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
            <th scope="col">Method</th>
            <th scope="col">Endpoint</th>
            <th scope="col">Status</th>
            <th scope="col">Time</th>
            <th scope="col">Duration</th>
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
