"use client";
import { useState } from "react";
import { Button, useToast } from "@/app/_ui";
import styles from "./runner.module.css";

export function BodyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [invalid, setInvalid] = useState(false);
  const toast = useToast();
  const lineCount = value.split("\n").length;

  function format() {
    try {
      const pretty = JSON.stringify(JSON.parse(value), null, 2);
      setInvalid(false);
      onChange(pretty);
    } catch {
      setInvalid(true);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard?.writeText(value);
      toast("Copied to clipboard");
    } catch {
      toast("Couldn't copy to clipboard");
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <Button variant="ghost" size="sm" onClick={format}>
          Format
        </Button>
        <Button variant="ghost" size="sm" onClick={copy}>
          Copy
        </Button>
        {invalid && (
          <span data-invalid className={styles.invalid}>
            Invalid JSON
          </span>
        )}
      </div>
      <div className={styles.pane}>
        <div className={styles.gutter} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          aria-label="Request body"
          className={styles.textarea}
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setInvalid(false);
            onChange(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
