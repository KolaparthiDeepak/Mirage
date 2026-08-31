"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./ui.module.css";

type Item = { label: string; onSelect: () => void; disabled?: boolean };
type Props = { trigger: ReactNode; items: Item[] };

export function Dropdown({ trigger, items }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const itemButtons = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
    [],
  );

  const focusItem = useCallback(
    (index: number) => {
      const btns = itemButtons().filter((b) => b.getAttribute("aria-disabled") !== "true");
      if (btns.length === 0) return false;
      const wrapped = ((index % btns.length) + btns.length) % btns.length;
      btns[wrapped]?.focus();
      return true;
    },
    [itemButtons],
  );

  // Focus the first enabled item when the menu opens; fall back to the menu
  // itself when every item is disabled so Esc/Tab still work.
  useEffect(() => {
    if (open && !focusItem(0)) menuRef.current?.focus();
  }, [open, focusItem]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const enabled = itemButtons().filter((b) => b.getAttribute("aria-disabled") !== "true");
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(enabled.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={wrap} className={styles.dropdown}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.dropdownTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              tabIndex={-1}
              className={styles.menuItem}
              aria-disabled={it.disabled || undefined}
              onClick={() => {
                if (it.disabled) return;
                it.onSelect();
                close(true);
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
