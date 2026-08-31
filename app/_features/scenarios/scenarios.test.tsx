import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { PreviewProvider } from "@/app/_lib/preview-store";
import ScenariosPage from "@/app/(app)/p/[slug]/scenarios/page";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const SLUG = "card-block-lost";
const KEYS = {
  getCard: "POST /x/GET_CARD/v1",
  blockCard: "POST /x/BLOCK_CARD/v1",
};

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [
    {
      slug: SLUG,
      name: "Card Block",
      caseCount: 0,
      endpoints: [
        { key: KEYS.getCard, method: "POST", path: "/x/GET_CARD/v1", runUrl: "", cases: [] },
        { key: KEYS.blockCard, method: "POST", path: "/x/BLOCK_CARD/v1", runUrl: "", cases: [] },
      ],
    },
  ],
} as never;

// Synchronously-fulfilled thenable so `use(params)` resolves without Suspense.
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
      <PreviewProvider>
        <ScenariosPage params={resolvedParams(SLUG)} />
      </PreviewProvider>
    </ViewModelProvider>,
  );
}

function stored() {
  return JSON.parse(sessionStorage.getItem("mockservers-preview")!);
}

describe("ScenariosPage", () => {
  it("seeds a scenario with one node per resolved seed endpoint", () => {
    renderPage();
    expect(screen.getByText("Step 1")).toBeDefined();
    expect(screen.getByText("Step 2")).toBeDefined();
    expect(screen.queryByText("Step 3")).toBeNull();
  });

  it("appends a step on 'Add step' and persists it across a rerender", () => {
    const { rerender } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    expect(screen.getByText("Step 3")).toBeDefined();
    expect(stored().scenarios[SLUG][0].steps).toHaveLength(3);

    rerender(
      <ViewModelProvider model={model}>
        <PreviewProvider>
          <ScenariosPage params={resolvedParams(SLUG)} />
        </PreviewProvider>
      </ViewModelProvider>,
    );
    expect(screen.getByText("Step 3")).toBeDefined();
  });

  it("disables the Run scenario button", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: "Run scenario" }),
    ).toHaveProperty("disabled", true);
  });

  it("writes an endpoint edit to the preview store", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Endpoint for step 1"), {
      target: { value: KEYS.blockCard },
    });
    expect(stored().scenarios[SLUG][0].steps[0].endpointKey).toBe(KEYS.blockCard);
  });
});
