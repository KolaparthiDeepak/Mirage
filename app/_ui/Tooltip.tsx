"use client";
import { useId, useState, type ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { label: string; children: ReactNode };

export function Tooltip({ label, children }: Props) {
  const id = useId();
  const [show, setShow] = useState(false);

  return (
    <span
      className={styles.tooltipWrap}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <span aria-describedby={id}>{children}</span>
      <span role="tooltip" id={id} hidden={!show} className={styles.tooltip}>
        {label}
      </span>
    </span>
  );
}
