import { verdictText } from "@/app/_lib/format";
import type { Verdict } from "@/src/viewer/verdict";
import styles from "./runner.module.css";

export function VerdictLine({ verdict }: { verdict: Verdict }) {
  const { text, kind } = verdictText(verdict);
  return (
    <p className={styles.verdict} data-kind={kind}>
      {text}
    </p>
  );
}
