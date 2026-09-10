"use client";
import { useState, type KeyboardEvent } from "react";
import type { CaseVM } from "@/src/viewer/model";
import { Badge, Dropdown, StatusCode } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import { statusKind } from "@/app/_lib/status";
import { matchSummary } from "@/app/_lib/match-summary";
import styles from "./cases.module.css";

export function CaseRow({
  case_,
  selected,
  tabbable = selected,
  onSelect,
  slug,
  method,
  path,
  onChanged,
}: {
  case_: CaseVM;
  selected?: boolean;
  /** Roving-tabindex: true makes this the list's tab stop. Defaults to `selected`. */
  tabbable?: boolean;
  onSelect?: () => void;
  slug?: string;
  method?: string;
  path?: string;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const canWrite = !!(slug && method && path);

  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.target !== ev.currentTarget) return; // ignore keys from nested controls (⋯ menu)
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelect?.();
    }
    // ArrowUp/Down handled at the list level (needs sibling ids) — see CaseList.
  }

  async function duplicate() {
    if (!canWrite) return;
    setBusy(true);
    try {
      let id = `${case_.id}-copy`;
      let res = await adminFetch(`/api/projects/${slug}/rules`, {
        method: "POST",
        json: { id, request: { method, path, ...(case_.match.length > 0 ? { match: case_.match } : {}) }, response: case_.expected },
      });
      if (res.status === 409) {
        id = `${case_.id}-copy-${Date.now().toString(36)}`;
        res = await adminFetch(`/api/projects/${slug}/rules`, {
          method: "POST",
          json: { id, request: { method, path, ...(case_.match.length > 0 ? { match: case_.match } : {}) }, response: case_.expected },
        });
      }
      if (res.ok) onChanged?.();
    } catch (e) {
      if (!(e instanceof AdminAuthError)) throw e;
      alert(e.message); // a stopgap auth error, not a confirmation
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!canWrite) return;
    if (!confirm(`Delete case "${case_.label}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await adminFetch(`/api/projects/${slug}/rules/${encodeURIComponent(case_.id)}`, { method: "DELETE" });
      if (res.ok || res.status === 204) onChanged?.();
    } catch (e) {
      if (!(e instanceof AdminAuthError)) throw e;
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="option"
      tabIndex={tabbable ? 0 : -1}
      aria-selected={!!selected}
      className={case_.isOpenApiGenerated ? `${styles.row} ${styles.rowGenerated}` : styles.row}
      onClick={() => onSelect?.()}
      onKeyDown={onKeyDown}
    >
      <span className={styles.dot} data-kind={statusKind(case_.expected.status)} />
      <span className={styles.label}>{case_.label}</span>
      <span className={styles.match}>{matchSummary(case_.match)}</span>
      {case_.isOpenApiGenerated ? <Badge tone="neutral">generated</Badge> : null}
      <StatusCode code={case_.expected.status} />
      <span className={styles.overflow} onClick={(e) => e.stopPropagation()}>
        <Dropdown
          trigger={<span aria-label="Case actions">⋯</span>}
          items={[
            { label: "Edit", onSelect: () => onSelect?.(), disabled: !onSelect },
            { label: busy ? "Duplicating…" : "Duplicate", onSelect: duplicate, disabled: !canWrite || busy },
            { label: busy ? "Deleting…" : "Delete", onSelect: del, disabled: !canWrite || busy },
          ]}
        />
      </span>
    </div>
  );
}
