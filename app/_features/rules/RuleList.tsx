import type { EndpointVM } from "@/src/viewer/model";
import { RuleCard } from "./RuleCard";
import styles from "./rules.module.css";

export function RuleList({ endpoint }: { endpoint: EndpointVM }) {
  // Plan 23 empty state: a single, condition-free rule teaches nothing on
  // its own — point at the one action this page is for.
  const soleFallback = endpoint.cases.length === 1 && endpoint.cases[0]!.match.length === 0;
  return (
    <div className={styles.list}>
      <p className={styles.explainer}>
        {soleFallback
          ? "One rule, no conditions — add one below to branch on the request."
          : "Response selection tries these in order; the first whose conditions all match wins."}
      </p>
      {endpoint.cases.map((c, i) => (
        <RuleCard key={c.id} case_={c} order={i + 1} />
      ))}
    </div>
  );
}
