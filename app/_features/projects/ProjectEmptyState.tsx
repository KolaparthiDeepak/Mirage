"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState } from "@/app/_ui";
import { createSampleProject } from "@/app/_lib/sample-project";
import { CubeGlyph } from "./ProjectCard";
import styles from "./projects.module.css";

export function ProjectEmptyState({ onCreate }: { onCreate?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trySample() {
    setBusy(true);
    setError(null);
    const result = await createSampleProject();
    if (result.ok) router.push(`/p/${result.slug}`);
    else setError(result.error);
    setBusy(false);
  }

  return (
    <div className={styles.emptyWrap}>
      <EmptyState
        icon={<CubeGlyph />}
        title="Your API workspace is empty"
        body="Create your first mock server and start simulating APIs."
        action={
          <>
            <Button variant="primary" onClick={onCreate}>
              Create project
            </Button>
            <Button variant="secondary" onClick={trySample} disabled={busy}>
              {busy ? "Setting up…" : "Try a sample"}
            </Button>
          </>
        }
      />
      {error ? (
        <p role="alert" className={styles.note}>
          {error}
        </p>
      ) : null}
      <p className={styles.importHint}>or import an API specification</p>
    </div>
  );
}
