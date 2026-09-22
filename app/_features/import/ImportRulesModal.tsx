"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Tabs, tabPanelProps } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import { parseCurl } from "@/src/import/curl-parse";
import { parseHar } from "@/src/import/har-parse";
import type { RuleDraft } from "@/src/import/types";
import styles from "./import.module.css";

type Parsed = { drafts: RuleDraft[]; unsupported: string[] };

// Plan 08 — one pipeline, preview mandatory: nothing is written to config
// until the author ticks a row and hits Create.
export function ImportRulesModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"curl" | "har">("curl");
  const [curlText, setCurlText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function accept(r: ReturnType<typeof parseCurl>) {
    if ("error" in r) {
      setParsed(null);
      setError(r.error);
      return;
    }
    setError(null);
    setResult(null);
    setParsed(r);
    setSelected(new Set(r.drafts.map((d) => d.rule.id)));
  }

  function parseCurlInput() {
    accept(parseCurl(curlText));
  }

  async function onFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("HAR is over 5 MB");
      return;
    }
    accept(parseHar(await file.text()));
  }

  async function create() {
    if (!parsed) return;
    setBusy(true);
    setResult(null);
    const chosen = parsed.drafts.filter((d) => selected.has(d.rule.id));
    let created = 0;
    let collided = 0;
    let failed = 0;
    for (const d of chosen) {
      try {
        const res = await adminFetch(`/api/projects/${slug}/rules`, { method: "POST", json: d.rule });
        if (res.ok) created++;
        else if (res.status === 409) collided++;
        else failed++;
      } catch (e) {
        if (e instanceof AdminAuthError) {
          setError(e.message);
          setBusy(false);
          return;
        }
        failed++;
      }
    }
    setBusy(false);
    setResult(
      `Created ${created} rule${created === 1 ? "" : "s"}` +
        (collided ? `, skipped ${collided} that already exist` : "") +
        (failed ? `, ${failed} failed` : "") +
        ".",
    );
    if (created > 0) router.refresh();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Import rules">
      <div className={styles.modal}>
        <Tabs
          tabs={[
            { id: "curl", label: "cURL" },
            { id: "har", label: "HAR file" },
          ]}
          active={tab}
          onChange={(id) => setTab(id as "curl" | "har")}
          idBase="import-tabs"
        />

        <div {...tabPanelProps("import-tabs", tab)}>
          {tab === "curl" ? (
            <>
              <textarea
                className={styles.textarea}
                rows={5}
                placeholder="curl -X POST https://api.example.com/users -d '{&quot;name&quot;:&quot;Ada&quot;}'"
                value={curlText}
                onChange={(e) => setCurlText(e.target.value)}
              />
              <Button variant="secondary" onClick={parseCurlInput} disabled={!curlText.trim()}>
                Parse
              </Button>
            </>
          ) : (
            <input
              type="file"
              accept=".har,application/json"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          )}
        </div>

        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}

        {parsed ? (
          <div className={styles.preview}>
            <p className={styles.previewHead}>{parsed.drafts.length} rule(s) — tick the ones to create</p>
            <ul className={styles.draftList}>
              {parsed.drafts.map((d) => (
                <li key={d.rule.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(d.rule.id)}
                      onChange={() => toggle(d.rule.id)}
                    />{" "}
                    <code>
                      {d.rule.request.method} {d.rule.request.path}
                    </code>{" "}
                    → {d.rule.response?.status ?? d.rule.responses?.variants[0]?.status}
                  </label>
                </li>
              ))}
            </ul>
            {parsed.unsupported.length > 0 ? (
              <ul className={styles.warnings}>
                {parsed.unsupported.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            ) : null}
            <Button variant="primary" onClick={create} disabled={busy || selected.size === 0}>
              {busy ? "Creating…" : `Create ${selected.size} rule(s)`}
            </Button>
          </div>
        ) : null}

        {result ? <p className={styles.result}>{result}</p> : null}
      </div>
    </Modal>
  );
}
