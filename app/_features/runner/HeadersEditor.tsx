"use client";
import styles from "./runner.module.css";

export function HeadersEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.editor}>
      <textarea
        aria-label="Request headers"
        className={styles.textarea}
        spellCheck={false}
        placeholder="Content-Type: application/json"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
