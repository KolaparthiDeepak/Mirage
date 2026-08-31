"use client";
import { useEffect, useState } from "react";
import { usePreview } from "@/app/_lib/preview-store";
import { Button, Select, CopyButton } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import type { EndpointVM } from "@/src/viewer/model";
import { ruleYaml } from "@/app/_lib/rule-yaml";
import { ConditionRow, type Condition } from "./ConditionRow";
import styles from "./rules.module.css";

const BLANK: Condition = { field: "", op: "equals", value: "" };

export function RuleBuilder({
  slug,
  endpoint,
}: {
  slug: string;
  endpoint: EndpointVM;
}) {
  const { state, set } = usePreview();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [caseId, setCaseId] = useState(endpoint.cases[0]?.id ?? "");
  const [yaml, setYaml] = useState<string | null>(null);

  // Hydrate local state from the preview store once, on mount. The page keys
  // this component by endpoint, so a new endpoint remounts and re-hydrates.
  useEffect(() => {
    const draft = state.rulesDraft[endpoint.key] ?? [];
    if (draft.length > 0) {
      setCaseId(draft[0]!.caseId);
      // op === "" marks a caseId-only placeholder (no conditions yet)
      const real = draft.filter((d) => d.op !== "");
      if (real.length > 0) {
        setConditions(
          real.map((d) => ({ field: d.field, op: d.op, value: d.value })),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync(nextConditions: Condition[], nextCaseId: string) {
    setConditions(nextConditions);
    setCaseId(nextCaseId);
    setYaml(null);
    set((s) => ({
      ...s,
      rulesDraft: {
        ...s.rulesDraft,
        [endpoint.key]:
          nextConditions.length > 0
            ? nextConditions.map((c, i) => ({
                id: `${endpoint.key}-${i}`,
                field: c.field,
                op: c.op,
                value: c.value,
                caseId: nextCaseId,
              }))
            : // keep the chosen return case alive with no conditions
              [
                {
                  id: `${endpoint.key}-case`,
                  field: "",
                  op: "",
                  value: "",
                  caseId: nextCaseId,
                },
              ],
      },
    }));
  }

  return (
    <div className={styles.builder}>
      <div className={styles.builderHead}>
        <h3 className={styles.subhead}>Rule builder</h3>
        <PreviewBadge />
      </div>

      {conditions.map((c, i) => (
        <ConditionRow
          key={i}
          condition={c}
          onChange={(next) =>
            sync(
              conditions.map((c2, j) => (j === i ? next : c2)),
              caseId,
            )
          }
          onRemove={() =>
            sync(
              conditions.filter((_, j) => j !== i),
              caseId,
            )
          }
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => sync([...conditions, { ...BLANK }], caseId)}
      >
        Add condition
      </Button>

      <label className={styles.field}>
        <span className={styles.label}>Return case</span>
        <Select value={caseId} onChange={(e) => sync(conditions, e.target.value)}>
          {endpoint.cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </label>

      <Button
        variant="secondary"
        onClick={() =>
          setYaml(ruleYaml(conditions, caseId, endpoint.method, endpoint.path))
        }
      >
        Export YAML
      </Button>

      {yaml ? (
        <div className={styles.yamlBlock}>
          <pre className={styles.pre}>{yaml}</pre>
          <CopyButton text={() => yaml} label="Copy YAML" />
        </div>
      ) : null}

      <p className={styles.note}>
        This builds a <code>routes/*.yaml</code> block — paste it into{" "}
        <code>mocks/{slug}/routes/</code> and redeploy. It does NOT change the
        running mock.
      </p>
    </div>
  );
}
