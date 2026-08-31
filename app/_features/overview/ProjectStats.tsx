"use client";
import type { ProjectVM } from "@/src/viewer/model";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import styles from "./overview.module.css";

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.cell}>
      <div className={styles.cellValue}>{value}</div>
      <div className={styles.cellLabel}>{label}</div>
    </div>
  );
}

export function ProjectStats({ project }: { project: ProjectVM }) {
  return (
    <div className={styles.stats}>
      <Cell value={String(project.endpoints.length)} label="Endpoints" />
      <Cell value={String(project.caseCount)} label="Cases" />
      <div className={styles.previewGroup}>
        <div className={styles.previewHead}>
          <PreviewBadge />
        </div>
        <div className={styles.previewCells}>
          {/* Never a fabricated number — the backend does not report traffic. */}
          <Cell value="—" label="Requests" />
          <Cell value="—" label="Success" />
        </div>
      </div>
    </div>
  );
}
