"use client";
import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import { Button, Tabs, useToast } from "@/app/_ui";
import { copyToClipboard } from "@/app/_lib/clipboard";
import { usePreview } from "@/app/_lib/preview-store";
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
  const toast = useToast();
  const { activeEnv } = usePreview();

  // $ORIGIN resolves after mount so SSR and first client paint both emit the
  // literal placeholder (hydration-safe); the block corrects itself next paint.
  // A non-local active env resolves to that env's baseUrl so the cURL matches it.
  const [origin, setOrigin] = useState("$ORIGIN");
  useEffect(() => {
    setOrigin(
      activeEnv.baseUrl
        ? activeEnv.baseUrl.replace(/\/+$/, "")
        : window.location.origin,
    );
  }, [activeEnv.baseUrl]);
  const resolvedCurl = draft.curl.split("$ORIGIN").join(origin);

  const copyCurl = useCallback(async () => {
    toast((await copyToClipboard(resolvedCurl)) ? "cURL copied" : "Couldn't copy to clipboard");
  }, [resolvedCurl, toast]);

  // Imperative handle for the ⌘⇧C shortcut wired in P2.8.
  useEffect(() => {
    if (!copyCurlRef) return;
    copyCurlRef.current = () => {
      void copyCurl();
    };
    return () => {
      copyCurlRef.current = null;
    };
  }, [copyCurlRef, copyCurl]);

  const label = TABS.find((t) => t.id === active)?.label ?? "";

  return (
    <div className={styles.codegen}>
      <Tabs tabs={TABS} active={active} onChange={setActive} />
      {active === "curl" ? (
        <div className={styles.codeRow}>
          <pre className={styles.codeBlock}>{resolvedCurl}</pre>
          <Button variant="ghost" size="sm" onClick={copyCurl}>
            Copy
          </Button>
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
