"use client";
import type { ProjectVM } from "@/src/viewer/model";
import type { ProjectConfigLite } from "@/app/_lib/project-config-context";
import { mockPath } from "@/app/_lib/mock-url";
import styles from "./settings.module.css";

export function ServerTab({
  slug,
  project,
  config,
}: {
  slug: string;
  project: ProjectVM;
  config: ProjectConfigLite;
}) {
  return (
    <div className={styles.tabPanel}>
      <dl className={styles.dl}>
        <dt>Status</dt>
        <dd>Running</dd>
        <dt>CORS</dt>
        <dd>{config.defaults.cors ? "enabled" : "disabled"}</dd>
        <dt>Default delay</dt>
        <dd>{config.defaults.delayMs} ms</dd>
        <dt>Base URL</dt>
        <dd>
          <code className={styles.code}>{mockPath(slug, project.basePath)}</code>
        </dd>
      </dl>
    </div>
  );
}
