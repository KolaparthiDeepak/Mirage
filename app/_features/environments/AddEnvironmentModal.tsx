"use client";
import { useState } from "react";
import { usePreview } from "@/app/_lib/preview-store";
import { Button, Input, Modal } from "@/app/_ui";
import styles from "./environments.module.css";

export function AddEnvironmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { set } = usePreview();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  function add() {
    set((s) => ({
      ...s,
      environments: [
        ...s.environments,
        {
          id: globalThis.crypto?.randomUUID?.() ?? `env-${s.environments.length}-${Date.now()}`,
          name: name.trim(),
          baseUrl: baseUrl.trim(),
        },
      ],
    }));
    setName("");
    setBaseUrl("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add environment">
      <h2 className={styles.modalTitle}>Add environment</h2>
      <div className={styles.form}>
        <label className={styles.field}>
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          Base URL
          <Input
            mono
            placeholder="https://staging.example.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </label>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !baseUrl.trim()}
            onClick={add}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
