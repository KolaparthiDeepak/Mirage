"use client";
import { useState } from "react";
import { usePreview } from "@/app/_lib/preview-store";
import { Badge, Button, EmptyState } from "@/app/_ui";
import { AddVariableModal } from "./AddVariableModal";
import styles from "./variables.module.css";

export function VariableTable() {
  const { state, set } = usePreview();
  const [adding, setAdding] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(id: string) {
    set((s) => ({ ...s, variables: s.variables.filter((v) => v.id !== id) }));
  }

  return (
    <>
      {state.variables.length === 0 ? (
        <EmptyState
          title="No variables"
          body="Add a variable — it's substituted locally, never sent to the backend."
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Value</th>
                <th scope="col">Scope</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {state.variables.map((v) => {
                const shown = revealed.has(v.id);
                return (
                  <tr key={v.id}>
                    <td className={styles.mono} data-label="Variable">{v.key}</td>
                    <td className={styles.mono} data-label="Value">
                      {shown ? v.value : "••••••••"}
                    </td>
                    <td data-label="Scope">
                      <Badge tone="neutral">{v.scope}</Badge>
                    </td>
                    <td className={styles.actions} data-label="Actions">
                      <button
                        type="button"
                        className={styles.linkBtn}
                        aria-label={shown ? `Hide ${v.key}` : `Reveal ${v.key}`}
                        aria-pressed={shown}
                        onClick={() => toggle(v.id)}
                      >
                        {shown ? "Hide" : "Reveal"}
                      </button>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        aria-label={`Delete ${v.key}`}
                        onClick={() => remove(v.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.footer}>
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Add variable
        </Button>
      </div>
      <AddVariableModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
