"use client";
// Plan 16 — list saved flows and run them, with per-step results inline.
// Authoring a flow (the step editor) is API/curl-only for now — see the
// commit notes; this panel is read + run, the part every flow needs after
// it's written.
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, StatusCode } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import styles from "./flows.module.css";

interface FlowSummary {
  id: string;
  name: string;
  updatedAt: string;
}
interface StepResult {
  name: string;
  method: string;
  path: string;
  status: number;
  matchedRuleId: string | null;
  passed: boolean;
  error?: string;
  assertions: Array<{ description: string; passed: boolean; expected?: unknown; actual?: unknown }>;
}
interface RunResult {
  runId: string;
  status: "passed" | "failed" | "error";
  steps: StepResult[];
}

export function FlowsPanel({ slug }: { slug: string }) {
  const [flows, setFlows] = useState<FlowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});

  useEffect(() => {
    fetch(`/api/projects/${slug}/flows`)
      .then((r) => r.json())
      .then((d) => setFlows(d.flows ?? []))
      .catch(() => setFlows([]));
  }, [slug]);

  async function run(id: string) {
    setRunning(id);
    setError(null);
    try {
      const res = await adminFetch(`/api/projects/${slug}/flows/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `run failed (${res.status})`);
        return;
      }
      setResults((prev) => ({ ...prev, [id]: data }));
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  if (flows === null) return null;

  if (flows.length === 0) {
    return (
      <EmptyState
        title="No flows yet"
        body={`POST a flow definition to /api/projects/${slug}/flows — a saved, runnable sequence of requests with assertions.`}
      />
    );
  }

  return (
    <div className={styles.list}>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {flows.map((f) => {
        const result = results[f.id];
        return (
          <div key={f.id} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.name}>{f.name}</span>
              <Button variant="secondary" size="sm" onClick={() => run(f.id)} disabled={running === f.id}>
                {running === f.id ? "Running…" : "Run"}
              </Button>
            </div>
            {result ? (
              <div className={styles.result}>
                <Badge tone={result.status === "passed" ? "success" : result.status === "failed" ? "error" : "warning"}>
                  {result.status}
                </Badge>
                <ol className={styles.steps}>
                  {result.steps.map((s, i) => (
                    <li key={i} data-passed={s.passed}>
                      <span className={styles.stepName}>{s.name}</span>
                      <StatusCode code={s.status} />
                      {s.matchedRuleId ? <code className={styles.mono}>{s.matchedRuleId}</code> : null}
                      {s.error ? <span className={styles.error}>{s.error}</span> : null}
                      {s.assertions.filter((a) => !a.passed).map((a, j) => (
                        <div key={j} className={styles.assertFail}>
                          {a.description} — expected {JSON.stringify(a.expected)}, got {JSON.stringify(a.actual)}
                        </div>
                      ))}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
