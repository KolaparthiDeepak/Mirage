"use client";
import { use, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EndpointVM } from "@/src/viewer/model";
import { useProject } from "@/app/_lib/view-model-context";
import { useDebounced } from "@/app/_lib/use-debounced";
import { commandCode } from "@/app/_lib/endpoint-label";
import { Button, Tooltip } from "@/app/_ui";
import { PageHeader } from "@/app/_shell/PageHeader";
import { EndpointToolbar } from "@/app/_features/endpoints/EndpointToolbar";
import { EndpointList } from "@/app/_features/endpoints/EndpointList";
import { EndpointWorkspace } from "@/app/_features/endpoints/EndpointWorkspace";
import styles from "@/app/_features/endpoints/endpoints.module.css";

function groupPrefix(path: string): string {
  const cc = commandCode(path);
  const i = path.indexOf(`/${cc}`);
  return i > 0 ? path.slice(0, i) : "/";
}

export default function EndpointsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const project = useProject(slug)!;
  const router = useRouter();
  const workspaceKey = useSearchParams().get("e");

  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [view, setView] = useState<"all" | "grouped">("all");
  const q = useDebounced(query, 150).trim().toLowerCase();

  const methods = useMemo(
    () => [...new Set(project.endpoints.map((e) => e.method))].sort(),
    [project.endpoints],
  );

  const filtered = useMemo(
    () =>
      project.endpoints.filter((e) => {
        if (method !== "all" && e.method !== method) return false;
        if (!q) return true;
        return (
          commandCode(e.path).toLowerCase().includes(q) ||
          e.path.toLowerCase().includes(q) ||
          (e.summary?.toLowerCase().includes(q) ?? false)
        );
      }),
    [project.endpoints, method, q],
  );

  const groups = useMemo(() => {
    const m = new Map<string, EndpointVM[]>();
    for (const e of filtered) {
      const k = groupPrefix(e.path);
      const list = m.get(k) ?? [];
      list.push(e);
      m.set(k, list);
    }
    return [...m.entries()];
  }, [filtered]);

  const onSelect = (key: string) => router.push(`/p/${slug}/endpoints?e=${key}`);

  return (
    <>
      <PageHeader
        title="Endpoints"
        actions={
          <Tooltip label="Preview — add endpoints via the repo">
            <Button variant="secondary" aria-disabled onClick={(e) => e.preventDefault()}>
              New Endpoint
            </Button>
          </Tooltip>
        }
      />

      {workspaceKey ? (
        <EndpointWorkspace project={project} />
      ) : (
        <>
          <EndpointToolbar
            query={query}
            onQuery={setQuery}
            method={method}
            onMethod={setMethod}
            methods={methods}
            view={view}
            onView={setView}
          />

          {filtered.length === 0 ? (
            <div className={styles.empty}>No endpoints match.</div>
          ) : view === "grouped" ? (
            groups.map(([prefix, eps]) => (
              <section key={prefix}>
                <div className={styles.groupLabel}>{prefix}</div>
                <EndpointList endpoints={eps} onSelect={onSelect} />
              </section>
            ))
          ) : (
            <EndpointList endpoints={filtered} onSelect={onSelect} />
          )}
        </>
      )}
    </>
  );
}
