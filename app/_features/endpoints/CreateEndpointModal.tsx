"use client";
import { useState } from "react";
import { Button, Input, Select, CopyButton, Modal } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { newEndpointYaml } from "@/app/_lib/scaffold-yaml";
import styles from "./endpoints.module.css";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function CreateEndpointModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [method, setMethod] = useState("POST");
  const [path, setPath] = useState("");
  const [yaml, setYaml] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="New endpoint">
      <div className={styles.modalForm}>
        <label className={styles.field}>
          <span className={styles.label}>Method</span>
          <Select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setYaml(null);
            }}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Path</span>
          <Input
            value={path}
            placeholder="/my/path"
            onChange={(e) => {
              setPath(e.target.value);
              setYaml(null);
            }}
          />
        </label>

        <Button
          variant="primary"
          onClick={() =>
            setYaml(
              yaml
                ? null
                : newEndpointYaml({ method, path: path || "/my/path" }),
            )
          }
        >
          Create
        </Button>

        {yaml ? (
          <div className={styles.yamlBlock}>
            <pre className={styles.pre}>{yaml}</pre>
            <CopyButton text={() => yaml} label="Copy YAML" />
            <PreviewBadge />
            <p className={styles.note}>
              Add this to a file under <code>mocks/&lt;slug&gt;/routes/</code> and
              redeploy.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
