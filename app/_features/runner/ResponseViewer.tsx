"use client";
import { useState } from "react";
import { StatusCode, Tabs, Button, JsonView } from "@/app/_ui";
import { VerdictLine } from "./VerdictLine";
import type { RunResult } from "./types";
import styles from "./runner.module.css";

const TABS = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
  { id: "raw", label: "Raw" },
];

export function ResponseViewer({ result }: { result: RunResult }) {
  const [tab, setTab] = useState("body");
  const [pretty, setPretty] = useState(true);
  const size = new Blob([result.bodyText]).size;

  return (
    <div className={styles.response}>
      <div className={styles.respHead}>
        <StatusCode code={result.status} />
        <span className={styles.respMeta}>{result.ms} ms</span>
        <span className={styles.respMeta}>{size} B</span>
        <div className={styles.respToggle}>
          <Button
            variant={pretty ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPretty(true)}
          >
            Pretty
          </Button>
          <Button
            variant={pretty ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setPretty(false)}
          >
            Raw
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className={styles.respPanel}>
        {tab === "body" &&
          (pretty ? (
            <JsonView value={result.bodyText} />
          ) : (
            <pre className={styles.raw}>{result.bodyText}</pre>
          ))}
        {tab === "headers" && (
          <div className={styles.headerList}>
            {result.headers.map(([k, v]) => (
              <div key={k}>
                {k}: {v}
              </div>
            ))}
          </div>
        )}
        {tab === "raw" && <pre className={styles.raw}>{result.bodyText}</pre>}
      </div>

      <VerdictLine verdict={result.verdict} />
    </div>
  );
}
