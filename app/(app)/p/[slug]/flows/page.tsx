"use client";
import { use } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { FlowsPanel } from "@/app/_features/flows/FlowsPanel";

export default function FlowsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  useProject(slug); // layout already handles notFound; keeps breadcrumb context consistent

  return (
    <>
      <PageHeader
        title="Flows"
        description="Saved, runnable sequences of requests with assertions. Replaces the old scenario canvas."
      />
      <FlowsPanel slug={slug} />
    </>
  );
}
