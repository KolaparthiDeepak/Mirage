import type { ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({ variant, size = "md", ...rest }: Props) {
  return (
    <button
      data-variant={variant}
      data-size={size}
      className={styles.btn}
      {...rest}
    />
  );
}
