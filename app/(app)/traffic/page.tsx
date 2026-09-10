"use client";
import { useViewModel } from "@/app/_lib/view-model-context";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { TrafficView, type TrafficRowVM } from "@/app/_features/traffic/TrafficView";

// The backend now records real traffic (plan 04) — this page just isn't
// wired to query it yet (plan 05). An honest empty state until then; no more
// fabricated rows (see docs/plans/mirage/04-traffic-recording.md).
const rows: TrafficRowVM[] = [];

export default function WorkspaceTrafficPage() {
  useViewModel(); // keeps this inside the ViewModel provider boundary for when plan 05 needs it

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Requests to your mock APIs are recorded. This view isn't wired up to show them yet."
      />
      <PreviewBadge />
      <TrafficView rows={rows} exportName="workspace-traffic.json" />
    </>
  );
}
