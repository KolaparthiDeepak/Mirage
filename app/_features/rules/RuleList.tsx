import type { EndpointVM } from "@/src/viewer/model";
import { RuleCard } from "./RuleCard";
import styles from "./rules.module.css";

export function RuleList({ endpoint }: { endpoint: EndpointVM }) {
  return (
    <div className={styles.list}>
      <p className={styles.explainer}>
        Response selection tries these in order; the first whose conditions all
        match wins.
      </p>
      {endpoint.cases.map((c, i) => (
        <RuleCard key={c.id} case_={c} order={i + 1} />
      ))}
    </div>
  );
}
