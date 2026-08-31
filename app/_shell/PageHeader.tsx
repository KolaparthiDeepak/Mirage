"use client";
import type { ReactNode } from "react";
import styles from "./shell.module.css";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDesc}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}
