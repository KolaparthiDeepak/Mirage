"use client";
import { useRouter } from "next/navigation";
import { Drawer, Button, MethodPill, StatusCode, JsonView } from "@/app/_ui";
import { caseHref, endpointHref } from "@/app/_lib/nav";
import type { ProjectVM } from "@/src/viewer/model";
import type { TrafficEntry } from "./types";
import styles from "./traffic.module.css";

type Props = {
  entry: TrafficEntry | null;
  project: ProjectVM | null;
  open: boolean;
  onClose: () => void;
};

export function TrafficDrawer({ entry, project, open, onClose }: Props) {
  const router = useRouter();

  function replay() {
    if (!entry || !project) return;
    const ep = project.endpoints.find((e) => e.key === entry.endpointKey);
    const firstCase = ep?.cases[0];
    if (ep && firstCase) {
      router.push(caseHref(project.slug, entry.endpointKey, firstCase.id));
    } else {
      router.push(endpointHref(project.slug, entry.endpointKey));
    }
  }

  return (
    <Drawer open={open} onClose={onClose} side="right" aria-label="Request detail">
      {entry ? (
        <div className={styles.drawer}>
          <div className={styles.drawerHead}>
            <MethodPill method={entry.method} />
            <span className={styles.mono}>{entry.path}</span>
          </div>
          <div className={styles.drawerMeta}>
            <StatusCode code={entry.status} />
            <span className={styles.tabular}>{entry.ms} ms</span>
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionHead}>Request headers</h3>
            <JsonView value={JSON.stringify(entry.reqHeaders, null, 2)} />
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionHead}>Request body</h3>
            <JsonView value={entry.reqBody} />
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionHead}>Response</h3>
            <JsonView value={entry.resBody} />
          </section>

          <Button variant="primary" onClick={replay} disabled={!project}>
            Replay request
          </Button>
        </div>
      ) : null}
    </Drawer>
  );
}
