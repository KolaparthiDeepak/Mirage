import type { ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({ variant, size = "md", type, className, ...rest }: Props) {
  return (
    <button
      type={type ?? "button"}
      data-variant={variant}
      data-size={size}
      className={className ? `${styles.btn} ${className}` : styles.btn}
      {...rest}
    />
  );
}
