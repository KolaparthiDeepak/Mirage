"use client";
import { useState } from "react";
import { Button, Input } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import type { ProjectVM } from "@/src/viewer/model";
import type { ProjectConfigLite } from "@/app/_lib/project-config-context";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await adminFetch(`/api/projects/${slug}`, {
        method: "PATCH",
        json: { name, basePath: basePath || undefined },
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `save failed (${res.status})`);
        return;
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.tabPanel}>
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className={styles.help}>Display only — not written to project.yaml</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Base path</span>
        <Input
          value={basePath}
          onChange={(e) => {
            setBasePath(e.target.value);
            setSaved(false);
          }}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Slug</span>
        <Input value={project.slug} disabled />
      </label>

      <Button variant="primary" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
      {saved ? <p className={styles.note}>Saved — live immediately.</p> : null}
      {error ? (
        <p role="alert" className={styles.note}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
