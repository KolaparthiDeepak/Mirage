"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal } from "@/app/_ui";
import { adminFetch, AdminAuthError } from "@/app/_lib/admin-token";
import styles from "./settings.module.css";

export function DangerZoneTab({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteProject() {
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/projects/${slug}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError((await res.json()).error ?? `delete failed (${res.status})`);
        return;
      }
      router.push("/projects");
    } catch (e) {
      setError(e instanceof AdminAuthError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.tabPanel}>
      <Button
        variant="secondary"
        className={styles.dangerBtn}
        onClick={() => setOpen(true)}
      >
        Delete project
      </Button>

      {open ? (
        <Modal open onClose={() => setOpen(false)} title="Delete project">
          <div className={styles.modalBody}>
            <p>
              This permanently deletes <code>{slug}</code> and every rule in it. Its mock URL
              stops responding immediately. Type the slug to confirm.
            </p>
            <Input
              aria-label="Type the project slug to confirm"
              value={confirmText}
              placeholder={slug}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <Button
              variant="secondary"
              className={styles.dangerBtn}
              disabled={confirmText !== slug || busy}
              onClick={deleteProject}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {error ? (
              <p role="alert" className={styles.note}>
                {error}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
