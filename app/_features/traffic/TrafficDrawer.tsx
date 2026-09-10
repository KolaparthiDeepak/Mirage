"use client";
import { useEffect, useState } from "react";
import { Button, CopyButton, Drawer, MethodPill, StatusCode, JsonView } from "@/app/_ui";
import type { TrafficEntry } from "@/src/store/types";
import type { ExplainResult } from "@/src/engine/explain";
import styles from "./traffic.module.css";

type Props = {
  entry: TrafficEntry | null;
  open: boolean;
  onClose: () => void;
};

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildCurl(entry: TrafficEntry, origin: string): string {
  const url = `${origin}/m/${entry.slug}${entry.path}`;
  const parts = [`curl -sS -X ${entry.method} ${shellQuote(url)}`];
  for (const [k, v] of Object.entries(entry.reqHeaders)) {
    parts.push(`  -H ${shellQuote(`${k}: ${v}`)}`);
  }
  if (entry.reqBody) parts.push(`  -d ${shellQuote(entry.reqBody)}`);
  return parts.join(" \\\n");
}

/** Redacted values ("***") get a visible label — plan 05: "labelled so nobody
 *  thinks the value was empty." */
function RedactedAware({ value }: { value: string | null }) {
  if (value === "***") {
    return (
      <div className={styles.redacted}>
        <code>***</code> <span className={styles.muted}>(redacted)</span>
      </div>
    );
  }
  return <JsonView value={value ?? ""} />;
}

function HeadersView({ headers }: { headers: Record<string, string> }) {
  return (
    <dl className={styles.headersList}>
      {Object.entries(headers).map(([k, v]) => (
        <div key={k}>
          <dt className={styles.mono}>{k}</dt>
          <dd className={v === "***" ? styles.redacted : styles.mono}>
            {v === "***" ? <>*** <span className={styles.muted}>(redacted)</span></> : v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TraceView({ trace }: { trace: ExplainResult & { note?: string } }) {
  if (trace.outsideBasePath) {
    return <p className={styles.hint}>{trace.basePathHint}</p>;
  }
  return (
    <div>
      {trace.note && <p className={styles.hint}>{trace.note}</p>}
      {trace.requestHints.map((h) => (
        <p key={h} className={styles.hint}>{h}</p>
      ))}
      <ol className={styles.traceList}>
        {trace.traces.map((t) => (
          <li key={t.ruleId} data-winner={t.ruleId === trace.winnerRuleId || undefined}>
            <span className={styles.mono}>{t.ruleId}</span>{" "}
            <span>{t.method === "pass" ? "✓" : t.method === "fail" ? "✗" : "·"} method</span>{" "}
            <span>{t.path === "pass" ? "✓" : t.path === "fail" ? "✗" : "·"} path</span>{" "}
            <span>{t.match === "pass" ? "✓" : t.match === "fail" ? "✗" : "·"} match</span>
            {t.hint && <div className={styles.hint}>{t.hint}</div>}
            {t.conditions?.filter((c) => !c.passed).map((c) => (
              <div key={c.index} className={styles.hint}>
                condition {c.index}: expected vs actual &quot;{c.actual ?? "(absent)"}&quot;
                {c.hint ? ` — ${c.hint}` : ""}
              </div>
            ))}
          </li>
        ))}
      </ol>
      {trace.winnerRuleId === null && <p className={styles.muted}>no rule matched → defaults.notFound</p>}
    </div>
  );
}

export function TrafficDrawer({ entry, open, onClose }: Props) {
  const [trace, setTrace] = useState<(ExplainResult & { note?: string }) | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<{ status: number; body: string } | null>(null);

  useEffect(() => {
    setTrace(null);
    setReplayResult(null);
    if (!entry) return;
    fetch(`/api/projects/${entry.slug}/traffic/${entry.id}/trace`)
      .then((r) => r.json())
      .then(setTrace)
      .catch(() => setTrace(null));
  }, [entry]);

  async function replay() {
    if (!entry) return;
    setReplaying(true);
    setReplayResult(null);
    try {
      const res = await fetch(`/m/${entry.slug}${entry.path}`, {
        method: entry.method,
        headers: entry.reqHeaders,
        body: ["GET", "HEAD"].includes(entry.method) ? undefined : (entry.reqBody ?? undefined),
      });
      setReplayResult({ status: res.status, body: await res.text() });
    } catch (e) {
      setReplayResult({ status: 0, body: e instanceof Error ? e.message : String(e) });
    } finally {
      setReplaying(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} side="right" aria-label="Request detail">
      {entry ? (
        <div className={styles.drawer}>
          <div className={styles.drawerHead}>
            <MethodPill method={entry.method} />
            <span className={styles.mono}>{entry.path}</span>
          </div>
          <div className={styles.drawerMeta}>
            <StatusCode code={entry.status} />
            <span className={styles.tabular}>{entry.durationMs} ms</span>
            {entry.truncated && <span className={styles.muted}>(body truncated)</span>}
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionHead}>Request headers</h3>
            <HeadersView headers={entry.reqHeaders} />
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionHead}>Request body</h3>
            <RedactedAware value={entry.reqBody} />
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionHead}>Response</h3>
            <RedactedAware value={entry.resBody} />
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionHead}>Why this response?</h3>
            {trace ? <TraceView trace={trace} /> : <p className={styles.muted}>Loading…</p>}
          </section>

          <div className={styles.drawerActions}>
            <Button variant="primary" onClick={replay} disabled={replaying}>
              {replaying ? "Replaying…" : "Replay"}
            </Button>
            <CopyButton
              text={() => buildCurl(entry, typeof window !== "undefined" ? window.location.origin : "")}
              label="Copy as cURL"
            />
          </div>
          {replayResult && (
            <section className={styles.section}>
              <h3 className={styles.sectionHead}>Replay result</h3>
              <StatusCode code={replayResult.status} />
              <JsonView value={replayResult.body} />
            </section>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
