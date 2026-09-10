"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Modal } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import { slugify, jsonBodyOrEmpty } from "@/app/_lib/scaffold-yaml";
import styles from "./endpoints.module.css";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Plan 03: "The 15-second path is the default" — method, path, status, body,
// Create. Match conditions, headers and delay are progressive disclosure a
// later pass can add to this same form; this is the paste-a-response tab.
export function CreateEndpointModal({
  open,
  onClose,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState("POST");
  const [path, setPath] = useState("");
  const [status, setStatus] = useState("200");
  const [body, setBody] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyValid = jsonBodyOrEmpty(body).valid;

  async function create() {
    const effectivePath = path.trim() || "/my/path";
    const id = `${method.toLowerCase()}-${slugify(effectivePath)}-ok`;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/projects/${slug}/rules`, {
        method: "POST",
        json: {
          id,
          request: { method, path: effectivePath },
          response: { status: Number(status) || 200, body: JSON.parse(jsonBodyOrEmpty(body).text) },
        },
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `create failed (${res.status})`);
        return;
      }
      onClose();
      router.push(`/p/${slug}/endpoints?e=${encodeURIComponent(`${method} ${effectivePath}`)}`);
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New endpoint">
      <div className={styles.modalForm}>
        <label className={styles.field}>
          <span className={styles.label}>Method</span>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Path</span>
          <Input value={path} placeholder="/my/path" onChange={(e) => setPath(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <Input value={status} inputMode="numeric" onChange={(e) => setStatus(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Response body</span>
          <textarea
            className={styles.textarea}
            value={body}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
          />
          {!bodyValid ? (
            <span role="alert" className={styles.warn}>
              Response body isn&apos;t valid JSON — using <code>{"{}"}</code>
            </span>
          ) : null}
        </label>

        <Button variant="primary" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create"}
        </Button>
        {error ? (
          <p role="alert" className={styles.note}>
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
