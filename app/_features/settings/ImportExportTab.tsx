"use client";
import { Button, Tooltip } from "@/app/_ui";
import type { ProjectVM } from "@/src/viewer/model";
import styles from "./settings.module.css";

export function ImportExportTab({ project }: { project: ProjectVM }) {
  function exportJson() {
    const blob = new Blob([JSON.stringify({ project }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  return (
    <div className={styles.tabPanel}>
      <Button variant="secondary" onClick={exportJson}>
        Export JSON
      </Button>

      <p className={styles.note}>
        OpenAPI: drop a spec into <code>mocks/{project.slug}/openapi/</code> and
        redeploy.
      </p>

      <Tooltip label="Preview — not wired">
        <Button
          variant="secondary"
          aria-disabled
          onClick={(e) => e.preventDefault()}
        >
          Postman import
        </Button>
      </Tooltip>
    </div>
  );
}
