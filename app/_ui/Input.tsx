import type { InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean };

export function Input({ mono, ...rest }: Props) {
  return (
    <input data-mono={mono || undefined} className={styles.input} {...rest} />
  );
}
