"use client";
import { useState } from "react";
import { EndpointForm } from "@/app/_features/endpoints/EndpointForm";
import { CopyButton } from "@/app/_ui";
import { useTraffic } from "@/app/_lib/use-traffic";
import { mockBaseUrl } from "@/app/_lib/mock-url";
import styles from "./overview.module.css";

// Plan 23: "an empty workspace shows one thing" — the paste-a-response form,
// inline, not a modal. On save it becomes a live URL plus a watcher that
// flips the moment traffic (plan 04/05) shows the first real request —
// closing the create → call → see it loop without the visitor needing to
// know rules, matching or traffic exist yet.
export function FirstMockOnboarding({ slug, basePath }: { slug: string; basePath?: string }) {
  const [created, setCreated] = useState<{ method: string; path: string } | null>(null);
  // Only start polling traffic once there's something to watch for.
  const { rows } = useTraffic([slug], {}, created != null);
  const firstRequest = rows[0] ?? null;

  if (!created) {
    return (
      <section className={styles.onboarding}>
        <div className={styles.onboardingHead}>
          <h2 className={styles.h2}>Your first mock</h2>
          <span className={styles.onboardingStep}>1 of 1</span>
        </div>
        <EndpointForm slug={slug} submitLabel="Create mock" onCreated={(method, path) => setCreated({ method, path })} />
      </section>
    );
  }

  const url = `${mockBaseUrl(slug, basePath)}${created.path}`;
  const curl = `curl -sS ${url}`;

  return (
    <section className={styles.onboarding}>
      <p className={styles.liveNow}>Live now</p>
      <div className={styles.liveRow}>
        <code className={styles.mono}>{url}</code>
        <CopyButton text={url} />
      </div>
      <div className={styles.liveRow}>
        <code className={styles.mono}>{curl}</code>
        <CopyButton text={curl} />
      </div>
      {firstRequest ? (
        <p className={styles.mono}>
          Request received — {firstRequest.method} {firstRequest.path} → {firstRequest.status}
        </p>
      ) : (
        <p className={styles.waiting}>○ waiting for your first request…</p>
      )}
    </section>
  );
}
