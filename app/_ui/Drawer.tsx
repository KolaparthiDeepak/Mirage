"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useDialogFocus } from "./use-dialog-focus";
import styles from "./ui.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  /** Accessible name for the dialog. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
};

export function Drawer({
  open,
  onClose,
  side = "right",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  children,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useDialogFocus(open, panel);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabelledby ? undefined : (ariaLabel ?? "Details")}
      aria-labelledby={ariaLabelledby}
      hidden={!open}
      className={styles.drawerRoot}
    >
      <div className={styles.backdrop} onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        data-side={side}
        data-open={open || undefined}
        className={styles.drawerPanel}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
