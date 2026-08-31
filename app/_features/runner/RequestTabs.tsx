"use client";
import type { ReactNode } from "react";
import { Tabs } from "@/app/_ui";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import styles from "./runner.module.css";

const TABS = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "auth", label: "Auth" },
  { id: "body", label: "Body" },
  { id: "pre", label: "Pre-request" },
];

const SOON: Record<string, string> = {
  params: "Query params editing is coming soon.",
  auth: "Auth helpers are coming soon.",
  pre: "Pre-request scripts are coming soon.",
};

export function RequestTabs({
  active,
  onChange,
  body,
  headers,
}: {
  active: string;
  onChange: (id: string) => void;
  body: ReactNode;
  headers: ReactNode;
}) {
  return (
    <div className={styles.reqTabs}>
      <Tabs tabs={TABS} active={active} onChange={onChange} />
      <div className={styles.reqPanel}>
        {active === "body" ? (
          body
        ) : active === "headers" ? (
          headers
        ) : (
          <div className={styles.soon}>
            <PreviewBadge />
            <span>{SOON[active] ?? "Coming soon."}</span>
          </div>
        )}
      </div>
    </div>
  );
}
