"use client";
import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import { CopyButton, Tabs } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import type { RequestDraft } from "@/src/viewer/curl";
import styles from "./runner.module.css";

const TABS = [
  { id: "curl", label: "cURL" },
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "go", label: "Go" },
];

export function CodeGenerator({
  draft,
  copyCurlRef,
}: {
  draft: RequestDraft;
  copyCurlRef?: MutableRefObject<(() => void) | null>;
}) {
  const [active, setActive] = useState("curl");

  // $ORIGIN resolves after mount so SSR and first client paint both emit the
  // literal placeholder (hydration-safe); the block corrects itself next paint.
  const [origin, setOrigin] = useState("$ORIGIN");
  useEffect(() => setOrigin(window.location.origin), []);
  const resolvedCurl = draft.curl.split("$ORIGIN").join(origin);

  // Imperative handle for the ⌘⇧C shortcut wired in P2.8.
  useEffect(() => {
    if (!copyCurlRef) return;
    copyCurlRef.current = () => {
      navigator.clipboard?.writeText(resolvedCurl).catch(() => {});
    };
    return () => {
      copyCurlRef.current = null;
    };
  }, [copyCurlRef, resolvedCurl]);

  const label = TABS.find((t) => t.id === active)?.label ?? "";

  return (
    <div className={styles.codegen}>
      <Tabs tabs={TABS} active={active} onChange={setActive} />
      {active === "curl" ? (
        <div className={styles.codeRow}>
          <pre className={styles.codeBlock}>{resolvedCurl}</pre>
          <CopyButton text={() => resolvedCurl} />
        </div>
      ) : (
        <div className={styles.soon}>
          <PreviewBadge />
          <span>Code generation for {label} is coming soon.</span>
        </div>
      )}
    </div>
  );
}
