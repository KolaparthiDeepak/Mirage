"use client";
import { useState } from "react";
import { Button, Modal } from "@/app/_ui";
import styles from "./settings.module.css";

export function DangerZoneTab({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);

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
              Deleting removes <code>mocks/{slug}/</code> from the repository. Do
              that there and redeploy — this UI can&apos;t delete anything.
            </p>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
