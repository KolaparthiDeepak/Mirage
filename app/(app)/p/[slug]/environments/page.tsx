"use client";
import { use } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { EnvironmentList } from "@/app/_features/environments/EnvironmentList";

export default function EnvironmentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  useProject(slug); // layout already handles notFound; keeps breadcrumb context consistent

  return (
    <>
      <PageHeader
        title="Environments"
        description="Local selection only — the mock server always runs at one origin. Switching here rewrites the URL shown in the runner, nothing else."
        actions={<PreviewBadge />}
      />
      <EnvironmentList />
    </>
  );
}
