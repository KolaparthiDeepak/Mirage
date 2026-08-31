"use client";
import { useState } from "react";
import { Button, Input, CopyButton } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import type { ProjectVM } from "@/src/viewer/model";
import type { ProjectConfigLite } from "@/app/_lib/project-config-context";
import { projectYaml } from "@/app/_lib/project-yaml";
import styles from "./settings.module.css";

export function GeneralTab({
  slug,
  project,
  config,
}: {
  slug: string;
  project: ProjectVM;
  config: ProjectConfigLite;
}) {
  const [name, setName] = useState(config.name);
  const [basePath, setBasePath] = useState(config.basePath ?? "");
  const [description, setDescription] = useState("");
  const [yaml, setYaml] = useState<string | null>(null);

  return (
    <div className={styles.tabPanel}>
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setYaml(null);
          }}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className={styles.help}>shown in the UI only</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Base path</span>
        <Input
          value={basePath}
          onChange={(e) => {
            setBasePath(e.target.value);
            setYaml(null);
          }}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Slug</span>
        <Input value={project.slug} disabled />
      </label>

      <Button
        variant="secondary"
        onClick={() =>
          setYaml(
            yaml
              ? null
              : projectYaml({ name, slug: project.slug, basePath }),
          )
        }
      >
        Save changes
      </Button>

      {yaml ? (
        <div className={styles.yamlBlock}>
          <pre className={styles.pre}>{yaml}</pre>
          <CopyButton text={() => yaml} label="Copy YAML" />
          <PreviewBadge />
          <p className={styles.note}>
            Paste into <code>mocks/{slug}/project.yaml</code> and redeploy — the
            browser can&apos;t write the repo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
