"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EndpointVM } from "@/src/viewer/model";
import { Button, Input, Select, Modal } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import { commandCode } from "@/app/_lib/endpoint-label";
import { slugify, jsonBodyOrEmpty } from "@/app/_lib/scaffold-yaml";
import styles from "./cases.module.css";

const STATUSES = [200, 201, 400, 401, 404, 409, 500];

export function CreateCaseModal({
  open,
  onClose,
  slug,
  endpoint,
  endpoints,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  endpoint?: EndpointVM;
  endpoints?: EndpointVM[];
}) {
  const router = useRouter();
  const list = endpoint ? [endpoint] : (endpoints ?? []);
  const [targetKey, setTargetKey] = useState(endpoint?.key ?? list[0]?.key ?? "");
  const [name, setName] = useState("");
  const [status, setStatus] = useState(200);
  const [body, setBody] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = endpoint ?? list.find((e) => e.key === targetKey) ?? list[0];
  const bodyValid = jsonBodyOrEmpty(body).valid;

  async function create() {
    if (!target) return;
    const id = slugify(name) || `${target.method.toLowerCase()}-${slugify(target.path)}-${status}`;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/projects/${slug}/rules`, {
        method: "POST",
        json: {
          id,
          request: { method: target.method, path: target.path },
          response: { status, body: JSON.parse(jsonBodyOrEmpty(body).text) },
        },
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `create failed (${res.status})`);
        return;
      }
      onClose();
      router.push(`/p/${slug}/endpoints?e=${encodeURIComponent(target.key)}&c=${encodeURIComponent(id)}`);
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create response case">
      <div className={styles.modalForm}>
        {!endpoint && list.length > 0 ? (
          <label className={styles.field}>
            <span className={styles.label}>Endpoint</span>
            <Select value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
              {list.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.method} {commandCode(e.path)}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <Input value={name} placeholder="card blocked" onChange={(e) => setName(e.target.value)} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <Select value={status} onChange={(e) => setStatus(Number(e.target.value))}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Response body</span>
          <textarea className={styles.textarea} value={body} rows={4} onChange={(e) => setBody(e.target.value)} />
          {!bodyValid ? (
            <span className={styles.warn} role="alert">
              Response body isn&apos;t valid JSON — using <code>{"{}"}</code>
            </span>
          ) : null}
        </label>

        <Button variant="primary" disabled={!target || busy} onClick={create}>
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
