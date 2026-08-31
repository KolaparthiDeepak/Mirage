"use client";
import { commandCode } from "@/app/_lib/endpoint-label";
import { Select } from "@/app/_ui";
import type { EndpointVM } from "@/src/viewer/model";
import type { ScenarioStep } from "@/app/_lib/preview-store";
import styles from "./scenarios.module.css";

const STATUSES = [200, 201, 400, 401, 404, 409, 500];

export function ScenarioNode({
  step,
  index,
  endpoints,
  onChange,
  onRemove,
}: {
  step: ScenarioStep;
  index: number;
  endpoints: EndpointVM[];
  onChange: (s: ScenarioStep) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.node}>
      <span className={styles.stepLabel}>Step {index + 1}</span>

      <Select
        aria-label={`Endpoint for step ${index + 1}`}
        value={step.endpointKey}
        onChange={(e) => onChange({ ...step, endpointKey: e.target.value })}
      >
        {endpoints.map((ep) => (
          <option key={ep.key} value={ep.key}>
            {commandCode(ep.path)}
          </option>
        ))}
      </Select>

      <Select
        aria-label={`Expected status for step ${index + 1}`}
        value={String(step.expectedStatus)}
        onChange={(e) =>
          onChange({ ...step, expectedStatus: Number(e.target.value) })
        }
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <button
        type="button"
        className={styles.nodeRemove}
        aria-label={`Remove step ${index + 1}`}
        onClick={onRemove}
      >
        &times;
      </button>
    </div>
  );
}
