"use client";
import { useState } from "react";
import { Button, Select } from "@/app/_ui";
import { parseHeaderLines } from "@/app/_lib/format";
import { classifyResult } from "@/src/viewer/verdict";
import type { CaseVM } from "@/src/viewer/model";
import { BodyEditor } from "./BodyEditor";
import { HeadersEditor } from "./HeadersEditor";
import { RequestTabs } from "./RequestTabs";
import { ResponseViewer } from "./ResponseViewer";
import type { RunResult } from "./types";
import styles from "./runner.module.css";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function seedHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export function RequestBuilder({
  case_,
  onExecuted,
}: {
  case_: CaseVM;
  onExecuted?: () => void;
}) {
  const draft = case_.request;
  const [method, setMethod] = useState(draft.method);
  const [url, setUrl] = useState(draft.url);
  const [headersText, setHeadersText] = useState(seedHeaders(draft.headers));
  const [body, setBody] = useState(draft.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [activeTab, setActiveTab] = useState("body");

  async function execute() {
    setBusy(true);
    setError(null);
    setResult(null);
    const noBody = ["GET", "HEAD"].includes(method) || body.trim() === "";
    const started = performance.now();
    try {
      const res = await fetch(url, {
        method,
        headers: parseHeaderLines(headersText),
        body: noBody ? undefined : body,
      });
      const ms = Math.round(performance.now() - started);
      const bodyText = await res.text();
      setResult({
        status: res.status,
        ms,
        headers: [...res.headers.entries()],
        bodyText,
        verdict: classifyResult(res.headers, res.status, bodyText, {
          id: case_.id,
          expected: case_.expected,
        }),
      });
      onExecuted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMethod(draft.method);
    setUrl(draft.url);
    setHeadersText(seedHeaders(draft.headers));
    setBody(draft.body ?? "");
    setResult(null);
    setError(null);
  }

  return (
    <div
      className={styles.builder}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          execute();
        }
      }}
    >
      <div className={styles.methodRow}>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <input
          aria-label="Request URL"
          className={styles.urlInput}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button variant="primary" onClick={execute} disabled={busy}>
          {busy ? "Running…" : "Execute"}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Reset to case
        </Button>
      </div>

      <RequestTabs
        active={activeTab}
        onChange={setActiveTab}
        body={<BodyEditor value={body} onChange={setBody} />}
        headers={<HeadersEditor value={headersText} onChange={setHeadersText} />}
      />

      {draft.notes.map((n) => (
        <div key={n} className={styles.note}>
          ⚠ {n}
        </div>
      ))}

      {error && (
        <div role="alert" className={styles.error}>
          ✗ {error}
        </div>
      )}
      {result && <ResponseViewer result={result} />}
    </div>
  );
}
