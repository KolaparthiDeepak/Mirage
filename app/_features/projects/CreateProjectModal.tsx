"use client";
import { useState } from "react";
import { Button, Input, CopyButton, Modal } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { slugify, newProjectYaml } from "@/app/_lib/scaffold-yaml";
import styles from "./projects.module.css";

const STARTERS = [
  { id: "blank", label: "Blank project", note: "Start from an empty mock server." },
  { id: "openapi", label: "OpenAPI", note: "Import via mocks/<slug>/openapi/" },
  { id: "postman", label: "Postman", note: "Coming soon", dim: true },
  { id: "example", label: "Example API", note: "Coming soon", dim: true },
] as const;

export function CreateProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [yaml, setYaml] = useState<string | null>(null);
  const slug = slugify(name) || "my-api";

  return (
    <Modal open={open} onClose={onClose} title="Create a mock server">
      <div className={styles.modalForm}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <Input
            value={name}
            placeholder="My API"
            onChange={(e) => {
              setName(e.target.value);
              setYaml(null);
            }}
          />
          <span className={styles.slugPreview}>slug: {slug}</span>
        </label>

        <div>
          <span className={styles.label}>Choose how to start</span>
          <div className={styles.startRow}>
            {STARTERS.map((s) => (
              <div
                key={s.id}
                className={styles.startCard}
                data-selected={s.id === "blank"}
                data-dim={"dim" in s && s.dim ? true : undefined}
              >
                <span className={styles.startCardLabel}>{s.label}</span>
                <span className={styles.startCardNote}>{s.note}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() =>
            setYaml(yaml ? null : newProjectYaml({ name: name || "My API", slug }))
          }
        >
          Create project
        </Button>

        {yaml ? (
          <div className={styles.yamlBlock}>
            <pre className={styles.pre}>{yaml}</pre>
            <CopyButton text={() => yaml} label="Copy YAML" />
            <PreviewBadge />
            <p className={styles.note}>
              Create <code>mocks/{slug}/project.yaml</code> with this and redeploy
              — the browser can&apos;t add projects.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
