"use client";
import { useState } from "react";
import { usePreview } from "@/app/_lib/preview-store";
import { Badge, Button } from "@/app/_ui";
import { AddEnvironmentModal } from "./AddEnvironmentModal";
import styles from "./environments.module.css";

export function EnvironmentList() {
  const { state, set } = usePreview();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className={styles.list}>
        {state.environments.map((env) => {
          const active = env.id === state.activeEnvId;
          return (
            <button
              key={env.id}
              type="button"
              className={styles.row}
              data-active={active || undefined}
              aria-pressed={active}
              onClick={() => set((s) => ({ ...s, activeEnvId: env.id }))}
            >
              <span className={styles.name}>{env.name}</span>
              <span className={`${styles.url} ${styles.grow}`}>{env.baseUrl}</span>
              {active ? <Badge tone="success">Active</Badge> : null}
            </button>
          );
        })}
      </div>
      <Button variant="secondary" onClick={() => setAdding(true)}>
        Add environment
      </Button>
      <AddEnvironmentModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
