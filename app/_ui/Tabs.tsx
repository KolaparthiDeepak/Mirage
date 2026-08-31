"use client";
import { useId, type KeyboardEvent } from "react";
import styles from "./ui.module.css";

type Props = {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  /** Share this with `tabPanelProps` so the panel and tab reference each other.
   *  Omit if the consumer renders no associated panel. */
  idBase?: string;
};

/** Spread onto the `<div>` that holds a tab's panel content. `idBase` must be
 *  the same value passed to `<Tabs idBase>`; `activeId` is the current tab id. */
export function tabPanelProps(idBase: string, activeId: string) {
  return {
    role: "tabpanel" as const,
    id: `panel-${idBase}-${activeId}`,
    "aria-labelledby": `tab-${idBase}-${activeId}`,
    tabIndex: 0,
  };
}

export function Tabs({ tabs, active, onChange, idBase }: Props) {
  const autoId = useId();
  const base = idBase ?? autoId;

  function onKeyDown(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === active);
    if (i === -1) return;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    const target = tabs[next];
    if (!target) return;
    e.preventDefault();
    onChange(target.id);
  }

  return (
    <div role="tablist" className={styles.tablist} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`tab-${base}-${t.id}`}
          role="tab"
          type="button"
          aria-selected={t.id === active}
          aria-controls={`panel-${base}-${active}`}
          tabIndex={t.id === active ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
