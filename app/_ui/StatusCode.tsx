import { statusKind } from "@/app/_lib/status";
import styles from "./ui.module.css";

export function StatusCode({ code }: { code: number }) {
  return (
    <span data-kind={statusKind(code)} className={styles.sc}>
      {code}
    </span>
  );
}
