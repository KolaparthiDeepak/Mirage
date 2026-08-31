"use client";
import { use } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { useProjectConfig } from "@/app/_lib/project-config-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { SettingsTabs } from "@/app/_features/settings/SettingsTabs";

export default function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const project = useProject(slug);
  const config = useProjectConfig(slug);
  if (!project || !config) return null;

  return (
    <>
      <PageHeader title="Settings" description={project.name} />
      <SettingsTabs slug={slug} project={project} config={config} />
    </>
  );
}
