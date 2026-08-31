import styles from "./ui.module.css";

type Props = { width?: string; height?: string };

export function Skeleton({ width, height }: Props) {
  return (
    <span
      className={styles.skeleton}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
