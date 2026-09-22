"use client";
import { useEffect, useState } from "react";
import { newId } from "@/app/_lib/id";
import { Button, Select } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import type { EndpointVM } from "@/src/viewer/model";
import { ConditionRow, type Condition } from "./ConditionRow";
import styles from "./rules.module.css";

const blank = (): Condition => ({ id: newId(), field: "", op: "equals", value: "" });

const FIELD_RE = /^(?:(?:body|header|query)\.[\w.$-]+|[\w.$-]+)$/;

/** Same builder-path mapping rule-yaml.ts uses (body.x -> jsonPath: $.x,
 *  header.X -> header: X, query.X -> query: X), producing match-condition
 *  objects for the API instead of a YAML string. */
function conditionsToMatch(conditions: Condition[]): { valid: Record<string, unknown>[]; skipped: Condition[] } {
  const valid: Record<string, unknown>[] = [];
  const skipped: Condition[] = [];
  for (const c of conditions) {
    if (!c.field || !FIELD_RE.test(c.field)) {
      skipped.push(c);
      continue;
    }
    const dot = c.field.indexOf(".");
    const head = dot === -1 ? "" : c.field.slice(0, dot);
    const rest = dot === -1 ? c.field : c.field.slice(dot + 1);
    const targetKey = head === "header" ? "header" : head === "query" ? "query" : "jsonPath";
    const targetValue = targetKey === "jsonPath" ? `$.${rest}` : rest;
    const op = c.op === "exists" ? { exists: true } : { [c.op]: c.value };
    valid.push({ [targetKey]: targetValue, ...op });
  }
  return { valid, skipped };
}

export function RuleBuilder({
  slug,
  endpoint,
}: {
  slug: string;
  endpoint: EndpointVM;
}) {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [caseId, setCaseId] = useState(endpoint.cases[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Hydrate from the currently selected case's own match conditions on mount
  // and whenever the case changes — this now edits the real rule, so it must
  // start from what the rule actually has, not a client-only draft.
  useEffect(() => {
    const selected = endpoint.cases.find((c) => c.id === caseId);
    setConditions(
      (selected?.match ?? []).map((m) => {
        const targetKey = "jsonPath" in m ? "jsonPath" : "header" in m ? "header" : "query";
        const targetValue = (m as Record<string, string>)[targetKey]!;
        const field =
          targetKey === "jsonPath"
            ? `body.${targetValue.replace(/^\$\.?/, "")}`
            : `${targetKey}.${targetValue}`;
        const opKey = ("equals" in m && "equals") || ("notEquals" in m && "notEquals") || ("contains" in m && "contains") || ("regex" in m && "regex") || "exists";
        const value = opKey === "exists" ? "" : String((m as Record<string, unknown>)[opKey]);
        return { id: newId(), field, op: opKey, value };
      }),
    );
    setSaved(false);
    setWarning(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const selectedCase = endpoint.cases.find((c) => c.id === caseId);

  async function save() {
    if (!selectedCase) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    setWarning(null);
    const { valid: match, skipped } = conditionsToMatch(conditions);
    try {
      const res = await adminFetch(`/api/projects/${slug}/rules/${encodeURIComponent(caseId)}`, {
        method: "PATCH",
        json: {
          id: caseId,
          request: { method: endpoint.method, path: endpoint.path, ...(match.length > 0 ? { match } : {}) },
          response: selectedCase.expected,
        },
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `save failed (${res.status})`);
        return;
      }
      const body = await res.json();
      setWarning(body.warning ?? (skipped.length > 0 ? `${skipped.length} condition(s) had an invalid field and were skipped` : null));
      setSaved(true);
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function sync(next: Condition[]) {
    setConditions(next);
    setSaved(false);
  }

  return (
    <div className={styles.builder}>
      <div className={styles.builderHead}>
        <h3 className={styles.subhead}>Rule builder</h3>
      </div>

      {conditions.map((c, i) => (
        <ConditionRow
          key={c.id}
          condition={c}
          onChange={(next) => sync(conditions.map((c2, j) => (j === i ? next : c2)))}
          onRemove={() => sync(conditions.filter((_, j) => j !== i))}
        />
      ))}

      <Button variant="ghost" size="sm" onClick={() => sync([...conditions, blank()])}>
        Add condition
      </Button>

      <label className={styles.field}>
        <span className={styles.label}>Editing case</span>
        <Select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          {endpoint.cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </label>

      <Button variant="primary" onClick={save} disabled={busy || !selectedCase}>
        {busy ? "Saving…" : "Save"}
      </Button>

      {saved ? <p className={styles.note}>Saved — live immediately.</p> : null}
      {warning ? (
        <p role="alert" className={styles.note}>
          ⚠ {warning}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={styles.note}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
