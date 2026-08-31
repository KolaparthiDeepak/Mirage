import { Skeleton } from "@/app/_ui";
import styles from "@/app/_shell/app-error.module.css";

export default function AppRouteLoading() {
  return (
    <div className={styles.loading}>
      <Skeleton width="40%" height="28px" />
      <Skeleton height="16px" />
      <Skeleton height="16px" />
      <Skeleton width="70%" height="16px" />
    </div>
  );
}
