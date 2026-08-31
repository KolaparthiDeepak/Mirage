"use client";
import { use, useEffect } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { commandCode } from "@/app/_lib/endpoint-label";
import { usePreview, type ScenarioStep } from "@/app/_lib/preview-store";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { ScenarioToolbar } from "@/app/_features/scenarios/ScenarioToolbar";
import { ScenarioCanvas } from "@/app/_features/scenarios/ScenarioCanvas";

const SEED_STEPS = ["GET_CARD", "CHECK_CARD_ELIGIBILITY", "BLOCK_CARD", "NOTIFY_CUSTOMER"];

export default function ScenariosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const project = useProject(slug)!;
  const { state, set } = usePreview();

  const list = state.scenarios[slug] ?? [];

  // Seed a starter scenario the first time this project is opened. Guarded on
  // `=== undefined` (not `[]`) so it never re-seeds once the store knows this
  // project — including after the user clears its scenario.
  useEffect(() => {
    if (state.scenarios[slug] !== undefined) return;

    const steps: ScenarioStep[] = [];
    for (const name of SEED_STEPS) {
      const ep = project.endpoints.find((e) => commandCode(e.path) === name);
      if (ep) {
        steps.push({
          id: crypto.randomUUID?.() ?? `seed-${steps.length}`,
          endpointKey: ep.key,
          expectedStatus: 200,
        });
      }
    }
    if (steps.length === 0) return;

    set((s) => ({
      ...s,
      scenarios: {
        ...s.scenarios,
        [slug]: [
          { id: crypto.randomUUID?.() ?? "seed", name: "Card Blocking", steps },
        ],
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, state.scenarios]);

  const scenario = list[0];

  return (
    <>
      <PageHeader
        title="Scenarios"
        description="Chain requests into a workflow. Preview — chained execution isn't wired yet."
      />
      <PreviewBadge />

      {scenario ? (
        <>
          <ScenarioToolbar
            name={scenario.name}
            onName={(name) =>
              set((s) => ({
                ...s,
                scenarios: {
                  ...s.scenarios,
                  [slug]: [{ ...scenario, name }, ...list.slice(1)],
                },
              }))
            }
          />
          <ScenarioCanvas
            scenario={scenario}
            endpoints={project.endpoints}
            onChange={(updated) =>
              set((s) => ({
                ...s,
                scenarios: {
                  ...s.scenarios,
                  [slug]: [updated, ...list.slice(1)],
                },
              }))
            }
          />
        </>
      ) : null}
    </>
  );
}
