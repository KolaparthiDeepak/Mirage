import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { ToastProvider } from "@/app/_ui";
import ProjectOverview from "@/app/(app)/p/[slug]/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/p/demo",
  useRouter: () => ({ push: vi.fn() }),
}));

const draft = { method: "GET", url: "", headers: {}, curl: "", notes: [] };

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [
    {
      slug: "demo",
      name: "Demo API",
      caseCount: 35,
      endpoints: [
        {
          key: "GET_CARD",
          method: "GET",
          path: "/demo/GET_CARD/v1",
          runUrl: "",
          cases: [
            {
              id: "c1",
              label: "",
              isOpenApiGenerated: false,
              match: [],
              expected: { status: 200, body: {} },
              request: draft,
            },
          ],
        },
        {
          key: "POST_CARD",
          method: "POST",
          path: "/demo/POST_CARD/v1",
          runUrl: "",
          cases: [
            {
              id: "c2",
              label: "",
              isOpenApiGenerated: false,
              match: [],
              expected: { status: 201 },
              request: draft,
            },
          ],
        },
        { key: "DEL_CARD", method: "DELETE", path: "/demo/DEL_CARD/v1", runUrl: "", cases: [] },
      ],
    },
  ],
} as never;

// synchronously-fulfilled thenable so `use(params)` resolves without Suspense
function resolvedParams(slug: string) {
  const p = Promise.resolve({ slug }) as Promise<{ slug: string }> & {
    status: string;
    value: { slug: string };
  };
  p.status = "fulfilled";
  p.value = { slug };
  return p;
}

function renderPage() {
  return render(
    <ViewModelProvider model={model}>
      <ToastProvider>
        <ProjectOverview params={resolvedParams("demo")} />
      </ToastProvider>
    </ViewModelProvider>,
  );
}

afterEach(() => cleanup());

describe("Project Overview page", () => {
  it("renders the case count and the endpoint count", () => {
    renderPage();
    expect(screen.getByText("35")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("carries no Preview badge — traffic and stats are real as of plan 05", () => {
    renderPage();
    expect(screen.queryByText("Preview")).toBeNull();
  });

  it("shows the honest empty state for traffic until plan 05 wires it up (plan 04)", () => {
    renderPage();
    expect(screen.getByText("No traffic yet")).toBeDefined();
  });
});
