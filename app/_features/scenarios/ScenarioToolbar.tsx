"use client";
import { Button, Input, Tooltip } from "@/app/_ui";
import styles from "./scenarios.module.css";

export function ScenarioToolbar({
  name,
  onName,
}: {
  name: string;
  onName: (v: string) => void;
}) {
  return (
    <div className={styles.toolbar}>
      <Input
        aria-label="Scenario name"
        value={name}
        onChange={(e) => onName(e.target.value)}
      />
      <Tooltip label="Preview — scenarios don't execute yet">
        <Button variant="primary" disabled>
          Run scenario
        </Button>
      </Tooltip>
    </div>
  );
}
