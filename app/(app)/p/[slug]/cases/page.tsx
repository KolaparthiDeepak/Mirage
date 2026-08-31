"use client";
import { use } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { commandCode } from "@/app/_lib/endpoint-label";
import { Button, Tooltip, EmptyState } from "@/app/_ui";
import { PageHeader } from "@/app/_shell/PageHeader";
import { CaseList } from "@/app/_features/cases/CaseList";
import styles from "@/app/_features/cases/cases.module.css";

export default function CasesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const project = useProject(slug)!;

  return (
    <>
      <PageHeader
        title="Cases"
        actions={
          <Tooltip label="Preview — add cases via the repo">
            <Button variant="secondary" aria-disabled onClick={(e) => e.preventDefault()}>
              Add case
            </Button>
          </Tooltip>
        }
      />

      {project.endpoints.length === 0 ? (
        <EmptyState title="No endpoints" body="This project has no endpoints yet." />
      ) : (
        project.endpoints.map((e) => (
          <section key={e.key} className={styles.section}>
            <h3 className={styles.sectionHead}>
              {commandCode(e.path)} <span className={styles.count}>{e.cases.length}</span>
            </h3>
            {e.cases.length === 0 ? (
              <p className={styles.count}>No cases.</p>
            ) : (
              <CaseList cases={e.cases} />
            )}
          </section>
        ))
      )}
    </>
  );
}
