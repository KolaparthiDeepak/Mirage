"use client";
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Button, Tabs } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { renderCurl } from "@/app/_lib/format";
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
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Resolve $ORIGIN at click time (reads window.location.origin) — never in
  // render, so the SSR/first paint stays stable. See plan P2.7 NOTE.
  function copyCurl() {
    navigator.clipboard?.writeText(renderCurl(draft.curl));
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  }

  // Imperative handle for the ⌘⇧C shortcut wired in P2.8.
  useEffect(() => {
    if (!copyCurlRef) return;
    copyCurlRef.current = copyCurl;
    return () => {
      copyCurlRef.current = null;
    };
  });

  const label = TABS.find((t) => t.id === active)?.label ?? "";

  return (
    <div className={styles.codegen}>
      <Tabs tabs={TABS} active={active} onChange={setActive} />
      {active === "curl" ? (
        <div className={styles.codeRow}>
          <pre className={styles.codeBlock}>{draft.curl}</pre>
          <Button variant="ghost" size="sm" onClick={copyCurl}>
            {copied ? "Copied" : "Copy"}
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
