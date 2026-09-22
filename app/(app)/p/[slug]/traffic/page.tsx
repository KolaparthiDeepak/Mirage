"use client";
import { use } from "react";
import { PageHeader } from "@/app/_shell/PageHeader";
import { TrafficView } from "@/app/_features/traffic/TrafficView";

export default function TrafficPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Live requests to this mock API."
      />
      <TrafficView slugs={[slug]} exportName={`${slug}-traffic.json`} />
    </>
  );
}
