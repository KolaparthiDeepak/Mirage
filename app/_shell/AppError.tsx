"use client";
import Link from "next/link";
import { Button } from "@/app/_ui";
import styles from "./app-error.module.css";

export function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Something went off-script.</h1>
      <p className={styles.message}>{error.message}</p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/projects" className={styles.link}>
          Back to projects
        </Link>
      </div>
    </div>
  );
}
