"use client";
import { useState } from "react";
import { usePreview } from "@/app/_lib/preview-store";
import type { Variable } from "@/app/_lib/preview-store";
import { Button, Input, Modal, Select } from "@/app/_ui";
import styles from "./variables.module.css";

const SCOPES: Variable["scope"][] = ["Global", "Project", "QA", "Local"];

export function AddVariableModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { set } = usePreview();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<Variable["scope"]>("Global");

  function add() {
    set((s) => ({
      ...s,
      variables: [
        ...s.variables,
        {
          id: globalThis.crypto?.randomUUID?.() ?? `var-${s.variables.length}-${Date.now()}`,
          key: name.trim(),
          value: value.trim(),
          scope,
        },
      ],
    }));
    setName("");
    setValue("");
    setScope("Global");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add variable">
      <div className={styles.form}>
        <label className={styles.field}>
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          Value
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className={styles.field}>
          Scope
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value as Variable["scope"])}
          >
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !value.trim()}
            onClick={add}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
