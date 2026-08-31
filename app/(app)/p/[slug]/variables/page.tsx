"use client";
import { use } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { VariableTable } from "@/app/_features/variables/VariableTable";

// TODO(later): substitute {{VAR}} into request drafts

export default function VariablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  useProject(slug); // layout already handles notFound; keeps breadcrumb context consistent

  return (
    <>
      <PageHeader
        title="Variables"
        description="Local substitution only — never sent to the backend."
        actions={<PreviewBadge />}
      />
      <VariableTable />
    </>
  );
}
