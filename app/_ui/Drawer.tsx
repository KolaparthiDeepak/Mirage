"use client";
import { useEffect, type ReactNode } from "react";
import styles from "./ui.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: ReactNode;
};

export function Drawer({ open, onClose, side = "right", children }: Props) {
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
      hidden={!open}
      className={styles.drawerRoot}
    >
      <div className={styles.backdrop} onClick={onClose} />
      <div
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
