"use client";
import { use, useMemo } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { sampleTraffic } from "@/app/_features/traffic/sample-traffic";
import { TrafficView } from "@/app/_features/traffic/TrafficView";

export default function TrafficPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const project = useProject(slug)!;

  const rows = useMemo(
    () => sampleTraffic(project).map((entry) => ({ entry, project })),
    [project],
  );

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Sample request log — the mock backend does not record traffic yet."
      />
      <PreviewBadge />
      <TrafficView rows={rows} exportName={`${slug}-traffic-sample.json`} />
    </>
  );
}
