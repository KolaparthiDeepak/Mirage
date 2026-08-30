import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = {
  tone: "neutral" | "success" | "warning" | "error" | "info";
  children: ReactNode;
};

export function Badge({ tone, children }: Props) {
  return (
    <span data-tone={tone} className={styles.badge}>
      {children}
    </span>
  );
}
