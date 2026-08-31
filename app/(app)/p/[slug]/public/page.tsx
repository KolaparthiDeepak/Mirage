"use client";
import { use } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { useProjectConfig } from "@/app/_lib/project-config-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PublicServerPanel } from "@/app/_features/public/PublicServerPanel";

export default function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const project = useProject(slug)!;
  const config = useProjectConfig(slug);

  return (
    <>
      <PageHeader title="Public mock server" description={project.name} />
      <PublicServerPanel
        slug={slug}
        basePath={config?.basePath}
        hasOpenApi={config?.hasOpenApi ?? false}
      />
    </>
  );
}
