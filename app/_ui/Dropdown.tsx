"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ui.module.css";

type Item = { label: string; onSelect: () => void; disabled?: boolean };
type Props = { trigger: ReactNode; items: Item[] };

export function Dropdown({ trigger, items }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className={styles.dropdown}>
      <button
        type="button"
        className={styles.dropdownTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open ? (
        <div role="menu" className={styles.menu}>
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              className={styles.menuItem}
              aria-disabled={it.disabled || undefined}
              onClick={() => {
                if (it.disabled) return;
                it.onSelect();
                setOpen(false);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
