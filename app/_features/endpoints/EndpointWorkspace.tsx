"use client";
import { useId, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ProjectVM } from "@/src/viewer/model";
import { commandCode } from "@/app/_lib/endpoint-label";
import { Tabs, tabPanelProps, EmptyState } from "@/app/_ui";
import { EndpointList } from "./EndpointList";
import { CaseList } from "@/app/_features/cases/CaseList";
import { RequestBuilder } from "@/app/_features/runner/RequestBuilder";
import { CodeGenerator } from "@/app/_features/runner/CodeGenerator";
import styles from "./endpoints.module.css";

const MOBILE_TABS = [
  { id: "endpoints", label: "Endpoints" },
  { id: "cases", label: "Cases" },
  { id: "request", label: "Request" },
];

export function EndpointWorkspace({ project }: { project: ProjectVM }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const copyCurlRef = useRef<(() => void) | null>(null);
  const [mobileTab, setMobileTab] = useState("endpoints");
  const tabsId = useId();

  const eParam = searchParams.get("e");
  const cParam = searchParams.get("c");

  function setParams(next: { e?: string; c?: string | null }) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next.e !== undefined) sp.set("e", next.e);
    if (next.c === null) sp.delete("c");
    else if (next.c !== undefined) sp.set("c", next.c);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  if (project.endpoints.length === 0) {
    return <EmptyState title="No endpoints" body="This project has no endpoints yet." />;
  }

  const selectedEndpoint =
    project.endpoints.find((e) => e.key === eParam) ?? project.endpoints[0]!;
  const selectedCase =
    selectedEndpoint.cases.find((c) => c.id === cParam) ?? null;

  return (
    <div
      className={styles.workspace}
      data-mobile-tab={mobileTab}
      onKeyDown={(e) => {
        if (
          (e.metaKey || e.ctrlKey) &&
          e.shiftKey &&
          (e.key === "C" || e.key === "c") &&
          selectedCase
        ) {
          e.preventDefault();
          copyCurlRef.current?.();
        }
      }}
    >
      <div className={styles.mobileTabs}>
        <Tabs tabs={MOBILE_TABS} active={mobileTab} onChange={setMobileTab} idBase={tabsId} />
      </div>

      <div className={styles.col} data-col="endpoints" {...tabPanelProps(tabsId, "endpoints")}>
        <h2 className={styles.colHeader}>Endpoints</h2>
        <EndpointList
          endpoints={project.endpoints}
          selectedKey={selectedEndpoint.key}
          onSelect={(key) => {
            setParams({ e: key, c: null });
            setMobileTab("cases");
          }}
        />
      </div>

      <div className={styles.col} data-col="cases" {...tabPanelProps(tabsId, "cases")}>
        <h2 className={styles.colHeader}>
          Cases <span className={styles.colHint}>{commandCode(selectedEndpoint.path)}</span>
        </h2>
        <CaseList
          cases={selectedEndpoint.cases}
          selectedId={selectedCase?.id ?? null}
          onSelect={(id) => {
            setParams({ e: selectedEndpoint.key, c: id });
            setMobileTab("request");
          }}
        />
      </div>

      <div className={styles.col} data-col="request" {...tabPanelProps(tabsId, "request")}>
        <h2 className={styles.colHeader}>Request</h2>
        {selectedCase ? (
          <>
            <RequestBuilder key={selectedCase.id} case_={selectedCase} />
            <CodeGenerator draft={selectedCase.request} copyCurlRef={copyCurlRef} />
          </>
        ) : (
          <EmptyState
            title="Pick a case"
            body="Choose a case to build and run its request."
          />
        )}
      </div>
    </div>
  );
}
