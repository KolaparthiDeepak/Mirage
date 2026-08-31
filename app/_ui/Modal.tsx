"use client";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { useDialogFocus } from "./use-dialog-focus";
import styles from "./ui.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Focused instead of the panel when the modal opens (e.g. a search input). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Keep the heading in the a11y tree but hide it visually (e.g. command palette). */
  hideTitleVisually?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  initialFocusRef,
  hideTitleVisually,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useDialogFocus(open, panel, initialFocusRef);

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
      aria-labelledby={headingId}
      hidden={!open}
      className={styles.modalRoot}
    >
      <div className={styles.backdrop} onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={styles.modalPanel}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={headingId}
          className={hideTitleVisually ? styles.visuallyHidden : styles.dialogHeading}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
