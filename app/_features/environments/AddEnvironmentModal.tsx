"use client";
import { useState } from "react";
import { usePreview } from "@/app/_lib/preview-store";
import { newId } from "@/app/_lib/id";
import { Button, Input, Modal } from "@/app/_ui";
import styles from "./environments.module.css";

export function AddEnvironmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { set } = usePreview();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const trimmed = baseUrl.trim();
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      // The value is spliced into a copy-to-clipboard `curl "..."` command;
      // quotes / whitespace / `$` / backticks would break out of the quoting.
      if (/["'`$\s\\]/.test(trimmed)) throw new Error();
    } catch {
      setError("Enter a valid http(s) URL");
      return;
    }
    set((s) => ({
      ...s,
      environments: [
        ...s.environments,
        {
          id: newId(),
          name: name.trim(),
          baseUrl: trimmed,
        },
      ],
    }));
    setName("");
    setBaseUrl("");
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add environment">
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
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              if (error) setError(null);
            }}
          />
        </label>
        {error ? (
          <span role="alert" className={styles.error}>
            {error}
          </span>
        ) : null}
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
