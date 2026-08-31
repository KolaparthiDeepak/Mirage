"use client";
import { useMemo } from "react";
import { useViewModel } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { sampleTraffic } from "@/app/_features/traffic/sample-traffic";
import { TrafficView } from "@/app/_features/traffic/TrafficView";

export default function WorkspaceTrafficPage() {
  const model = useViewModel();

  const rows = useMemo(
    () =>
      model.projects.flatMap((p) =>
        sampleTraffic(p).map((entry) => ({ entry, project: p })),
      ),
    [model],
  );

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Sample request log across all projects — the mock backend does not record traffic yet."
      />
      <PreviewBadge />
      <TrafficView rows={rows} exportName="workspace-traffic-sample.json" />
    </>
  );
}
