"use client";
import { useState } from "react";
import { Button, Input, Select } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import type { ProjectConfigLite } from "@/app/_lib/project-config-context";
import styles from "./settings.module.css";

// Plan 07 UI. The URL is only shape-checked in the browser; the real SSRF
// gate (DNS + private-range) runs server-side on Save and on Test.
export function UpstreamTab({ slug, config }: { slug: string; config: ProjectConfigLite }) {
  const current = config.upstream;
  const [url, setUrl] = useState(current?.url ?? "");
  const [mode, setMode] = useState<"off" | "record" | "passthrough">(current?.mode ?? "off");
  const [forwardAuth, setForwardAuth] = useState(current?.forwardAuth ?? false);
  const [busy, setBusy] = useState<null | "save" | "test">(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function reset() {
    setError(null);
    setOk(null);
  }

  async function save() {
    reset();
    setBusy("save");
    try {
      const res = await adminFetch(`/api/projects/${slug}`, {
        method: "PATCH",
        json: { upstream: mode === "off" ? { url: url || "https://x", mode: "off" } : { url, mode, forwardAuth } },
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `save failed (${res.status})`);
        return;
      }
      setOk(mode === "off" ? "Upstream disabled." : "Saved — live immediately.");
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    reset();
    setBusy("test");
    try {
      const res = await adminFetch(`/api/projects/${slug}/upstream/test`, {
        method: "POST",
        json: { url, forwardAuth },
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) setError(data.error ?? `test failed (${res.status})`);
      else setOk(`Reached upstream — HTTP ${data.status}.`);
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.tabPanel}>
      <p className={styles.note}>
        When a request matches no rule, Mirage can forward it to a real service.
        Matched requests are always served by the mock — turning this on never
        changes an existing rule.
      </p>

      <label className={styles.field}>
        <span className={styles.label}>Upstream URL</span>
        <Input
          value={url}
          placeholder="https://api.example.com"
          onChange={(e) => {
            setUrl(e.target.value);
            reset();
          }}
        />
        <span className={styles.help}>Must be https. Private / link-local hosts are rejected.</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Mode</span>
        <Select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            reset();
          }}
        >
          <option value="off">Off — 404 unmatched requests (default)</option>
          <option value="record">Record — forward, return, and save the response</option>
          <option value="passthrough">Passthrough — forward and return, don&apos;t save</option>
        </Select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          <input
            type="checkbox"
            checked={forwardAuth}
            onChange={(e) => {
              setForwardAuth(e.target.checked);
              reset();
            }}
          />{" "}
          Forward the caller&apos;s Authorization header
        </span>
        <span className={styles.help}>Off by default — avoids capturing real credentials in recordings.</span>
      </label>

      <div className={styles.buttonRow}>
        <Button variant="primary" onClick={save} disabled={busy != null || (mode !== "off" && !url)}>
          {busy === "save" ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={test} disabled={busy != null || !url}>
          {busy === "test" ? "Testing…" : "Test connection"}
        </Button>
      </div>

      {ok ? <p className={styles.note}>{ok}</p> : null}
      {error ? (
        <p role="alert" className={styles.note}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
