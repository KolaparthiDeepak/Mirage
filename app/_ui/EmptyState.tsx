import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <div className={styles.empty}>
      {icon ? <div className={styles.emptyIcon}>{icon}</div> : null}
      <div className={styles.emptyTitle}>{title}</div>
      {body ? <p className={styles.emptyBody}>{body}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
