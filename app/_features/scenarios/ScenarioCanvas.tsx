"use client";
import { Button } from "@/app/_ui";
import type { EndpointVM } from "@/src/viewer/model";
import type { Scenario, ScenarioStep } from "@/app/_lib/preview-store";
import { newId } from "@/app/_lib/id";
import { ScenarioNode } from "./ScenarioNode";
import styles from "./scenarios.module.css";

export function ScenarioCanvas({
  scenario,
  endpoints,
  onChange,
}: {
  scenario: Scenario;
  endpoints: EndpointVM[];
  onChange: (s: Scenario) => void;
}) {
  function updateStep(i: number, step: ScenarioStep) {
    onChange({
      ...scenario,
      steps: scenario.steps.map((s, j) => (j === i ? step : s)),
    });
  }

  function removeStep(i: number) {
    onChange({ ...scenario, steps: scenario.steps.filter((_, j) => j !== i) });
  }

  function addStep() {
    onChange({
      ...scenario,
      steps: [
        ...scenario.steps,
        {
          id: newId(),
          endpointKey: endpoints[0]?.key ?? "",
          expectedStatus: 200,
        },
      ],
    });
  }

  return (
    <div className={styles.canvas}>
      {scenario.steps.map((step, i) => (
        <div key={step.id} className={styles.nodeWrap}>
          {i > 0 ? <div className={styles.connector} /> : null}
          <ScenarioNode
            step={step}
            index={i}
            endpoints={endpoints}
            onChange={(s) => updateStep(i, s)}
            onRemove={() => removeStep(i)}
          />
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={addStep}>
        Add step
      </Button>
    </div>
  );
}
