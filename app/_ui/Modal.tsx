"use client";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import styles from "./ui.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Focused instead of the panel when the modal opens (e.g. a search input). */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

function focusables(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function Modal({ open, onClose, title, children, initialFocusRef }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const restoreTo = document.activeElement as HTMLElement | null;
    (initialFocusRef?.current ?? panel.current)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panel.current) {
        const items = focusables(panel.current);
        if (items.length === 0) {
          e.preventDefault();
          panel.current.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (restoreTo?.isConnected) restoreTo.focus();
    };
  }, [open, onClose, initialFocusRef]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
        {children}
      </div>
    </div>
  );
}
