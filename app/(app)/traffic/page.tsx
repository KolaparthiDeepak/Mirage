"use client";
import { useViewModel } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { TrafficView } from "@/app/_features/traffic/TrafficView";

export default function WorkspaceTrafficPage() {
  const model = useViewModel();
  const slugs = model.projects.map((p) => p.slug);

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Live requests across every mock API."
      />
      <TrafficView slugs={slugs} exportName="workspace-traffic.json" />
    </>
  );
}
