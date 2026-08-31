"use client";
import { Input, Select } from "@/app/_ui";
import styles from "./rules.module.css";

const OPS = ["equals", "notEquals", "contains", "regex", "exists"];

export interface Condition {
  field: string;
  op: string;
  value: string;
}

export function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.condRow}>
      <Input
        aria-label="Condition field"
        placeholder="body.cardLast4"
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
      />
      <Select
        aria-label="Condition operator"
        value={condition.op}
        onChange={(e) => onChange({ ...condition, op: e.target.value })}
      >
        {OPS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      {condition.op !== "exists" ? (
        <Input
          aria-label="Condition value"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />
      ) : null}
      <button
        type="button"
        aria-label="Remove condition"
        className={styles.condRemove}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
