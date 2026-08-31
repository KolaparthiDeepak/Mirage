"use client";
import type { CaseVM } from "@/src/viewer/model";
import { StatusCode, JsonView } from "@/app/_ui";
import { matchSummary } from "@/app/_lib/match-summary";
import styles from "./cases.module.css";

export function CaseDetail({ case_ }: { case_: CaseVM }) {
  return (
    <div className={styles.detail}>
      <section>
        <p className={styles.detailLabel}>Expected status</p>
        <StatusCode code={case_.expected.status} />
      </section>

      <section>
        <p className={styles.detailLabel}>Expected body</p>
        <JsonView value={JSON.stringify(case_.expected.body ?? null, null, 2)} />
      </section>

      <section>
        <p className={styles.detailLabel}>Match</p>
        {case_.match.length === 0 ? (
          <p className={styles.matchList}>{matchSummary([])}</p>
        ) : (
          <ul className={styles.matchList}>
            {case_.match.map((c, i) => (
              <li key={i}>{matchSummary([c])}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
