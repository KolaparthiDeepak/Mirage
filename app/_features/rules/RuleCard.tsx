"use client";
import { Badge, StatusCode } from "@/app/_ui";
import { matchSummary } from "@/app/_lib/match-summary";
import type { CaseVM } from "@/src/viewer/model";
import styles from "./rules.module.css";

export function RuleCard({ case_, order }: { case_: CaseVM; order: number }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <Badge tone="neutral">rule {order}</Badge>
        <code className={styles.code}>{case_.label}</code>
      </div>

      <div className={styles.clause}>
        <span className={styles.kw}>IF</span>
        <span className={styles.cond}>
          {case_.match.length
            ? matchSummary(case_.match)
            : "fallback — matches any request"}
        </span>
      </div>

      <div className={styles.clause}>
        <span className={styles.kw}>THEN</span>
        <span>
          return case <code className={styles.code}>{case_.label}</code> status{" "}
        </span>
        <StatusCode code={case_.expected.status} />
      </div>
    </div>
  );
}
