"use client";
import Link from "next/link";
import { Fragment } from "react";
import styles from "./shell.module.css";

type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 ? (
              <span className={styles.crumbSep} aria-hidden="true">
                /
              </span>
            ) : null}
            {item.href && !isLast ? (
              <Link href={item.href} className={styles.crumbLink}>
                {item.label}
              </Link>
            ) : (
              <span
                className={styles.crumbCurrent}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
