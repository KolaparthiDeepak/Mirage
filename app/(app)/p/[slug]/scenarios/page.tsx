"use client";
import { use, useEffect } from "react";
import { useProject } from "@/app/_lib/view-model-context";
import { commandCode } from "@/app/_lib/endpoint-label";
import { usePreview, type Scenario, type ScenarioStep } from "@/app/_lib/preview-store";
import { newId } from "@/app/_lib/id";
import { PageHeader } from "@/app/_shell/PageHeader";
import { PreviewBadge } from "@/app/_shell/PreviewBadge";
import { Button, EmptyState } from "@/app/_ui";
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

  // Seed a starter scenario the first time this project is opened — only when
  // its endpoints carry the known command names. Guarded on `=== undefined`
  // (not `[]`) so it never re-seeds once the store knows this project.
  useEffect(() => {
    if (state.scenarios[slug] !== undefined) return;

    const steps: ScenarioStep[] = [];
    for (const name of SEED_STEPS) {
      const ep = project.endpoints.find((e) => commandCode(e.path) === name);
      if (ep) {
        steps.push({
          id: newId(),
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
        [slug]: [{ id: newId(), name: "Card Blocking", steps }],
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, state.scenarios]);

  const scenario = list[0];

  function addFirstScenario() {
    const first = project.endpoints[0];
    if (!first) return;
    const created: Scenario = {
      id: newId(),
      name: "New scenario",
      steps: [{ id: newId(), endpointKey: first.key, expectedStatus: 200 }],
    };
    set((s) => ({
      ...s,
      scenarios: { ...s.scenarios, [slug]: [created] },
    }));
  }

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
      ) : project.endpoints.length === 0 ? (
        <EmptyState
          title="No scenario yet"
          body="Add endpoints to this project before building a request workflow."
        />
      ) : (
        <EmptyState
          title="No scenario yet"
          body="Build a request workflow step by step."
          action={
            <Button variant="primary" onClick={addFirstScenario}>
              Add first step
            </Button>
          }
        />
      )}
    </>
  );
}
