"use client";
import { useState } from "react";
import type { EndpointVM } from "@/src/viewer/model";
import { Button, Input, Select, CopyButton, Modal } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { commandCode } from "@/app/_lib/endpoint-label";
import { slugify, newCaseYaml, jsonBodyOrEmpty } from "@/app/_lib/scaffold-yaml";
import styles from "./cases.module.css";

const STATUSES = [200, 201, 400, 401, 404, 409, 500];

export function CreateCaseModal({
  open,
  onClose,
  endpoint,
  endpoints,
}: {
  open: boolean;
  onClose: () => void;
  endpoint?: EndpointVM;
  endpoints?: EndpointVM[];
}) {
  const list = endpoint ? [endpoint] : (endpoints ?? []);
  const [targetKey, setTargetKey] = useState(endpoint?.key ?? list[0]?.key ?? "");
  const [name, setName] = useState("");
  const [status, setStatus] = useState(200);
  const [body, setBody] = useState("{}");
  const [latency, setLatency] = useState("0");
  const [yaml, setYaml] = useState<string | null>(null);

  const target = endpoint ?? list.find((e) => e.key === targetKey) ?? list[0];
  const reset = () => setYaml(null);
  const bodyValid = jsonBodyOrEmpty(body).valid;

  return (
    <Modal open={open} onClose={onClose} title="Create response case">
      <div className={styles.modalForm}>
        {!endpoint && list.length > 0 ? (
          <label className={styles.field}>
            <span className={styles.label}>Endpoint</span>
            <Select
              value={targetKey}
              onChange={(e) => {
                setTargetKey(e.target.value);
                reset();
              }}
            >
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
          <Input
            value={name}
            placeholder="card blocked"
            onChange={(e) => {
              setName(e.target.value);
              reset();
            }}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(Number(e.target.value));
              reset();
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Response body</span>
          <textarea
            className={styles.textarea}
            value={body}
            rows={4}
            onChange={(e) => {
              setBody(e.target.value);
              reset();
            }}
          />
          {!bodyValid ? (
            <span className={styles.warn} role="alert">
              Response body isn&apos;t valid JSON — using <code>{"{}"}</code>
            </span>
          ) : null}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Latency</span>
          <Input
            value={latency}
            inputMode="numeric"
            onChange={(e) => setLatency(e.target.value)}
          />
          <span className={styles.slugPreview}>ms (informational)</span>
        </label>

        <Button
          variant="primary"
          disabled={!target}
          onClick={() =>
            setYaml(
              yaml
                ? null
                : newCaseYaml({
                    id: slugify(name) || "new-case",
                    status,
                    body,
                    path: target?.path ?? "/my/path",
                    method: target?.method ?? "GET",
                  }),
            )
          }
        >
          Generate YAML
        </Button>

        {yaml ? (
          <div className={styles.yamlBlock}>
            <pre className={styles.pre}>{yaml}</pre>
            <CopyButton text={() => yaml} label="Copy YAML" />
            <PreviewBadge />
            <p className={styles.note}>
              Add this to the endpoint&apos;s file under{" "}
              <code>mocks/&lt;slug&gt;/routes/</code> and redeploy.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
