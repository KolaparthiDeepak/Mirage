import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { useState } from "react";
import type { CaseVM, EndpointVM } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { CaseList } from "./CaseList";
import CasesPage from "@/app/(app)/p/[slug]/cases/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/p/demo/cases",
  useRouter: () => ({ push: vi.fn() }),
}));

const draft = { method: "GET", url: "", headers: {}, curl: "", notes: [] };

function mk(id: string, over: Partial<CaseVM> = {}): CaseVM {
  return {
    id,
    label: id,
    isOpenApiGenerated: false,
    match: [{ jsonPath: "$.x", equals: "1" }],
    expected: { status: 200, body: null },
    request: draft,
    ...over,
  } as CaseVM;
}

const ep1: EndpointVM = {
  key: "GET_CARD",
  method: "GET",
  path: "/demo/GET_CARD/v1",
  runUrl: "",
  cases: [
    mk("c1"),
    mk("c2", { match: [], label: "fallback-case" }),
    mk("c3", { expected: { status: 404, body: null } }),
  ],
};
const ep2: EndpointVM = {
  key: "POST_CARD",
  method: "POST",
  path: "/demo/POST_CARD/v1",
  runUrl: "",
  cases: [mk("c4", { isOpenApiGenerated: true }), mk("c5")],
};

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [{ slug: "demo", name: "Demo", caseCount: 5, endpoints: [ep1, ep2] }],
} as never;

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
      <CasesPage params={resolvedParams("demo")} />
    </ViewModelProvider>,
  );
}

afterEach(() => cleanup());

describe("Cases page", () => {
  it("renders a CaseRow for every case in the project", () => {
    renderPage();
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("colours the 404 case dot with data-kind='4'", () => {
    const { container } = renderPage();
    const dots = [...container.querySelectorAll("[class*='dot']")];
    expect(dots.some((d) => d.getAttribute("data-kind") === "4")).toBe(true);
  });

  it("shows the fallback summary for an empty match", () => {
    renderPage();
    expect(screen.getByText("fallback (any request)")).toBeDefined();
  });

  it("badges an OpenAPI-generated case", () => {
    renderPage();
    expect(screen.getByText("generated")).toBeDefined();
  });
});

describe("CaseList keyboard nav", () => {
  function Harness() {
    const [sel, setSel] = useState<string | null>(null);
    return <CaseList cases={ep1.cases} selectedId={sel} onSelect={setSel} />;
  }

  it("ArrowDown from the first row moves aria-selected", () => {
    render(<Harness />);
    const rows = screen.getAllByRole("option");
    fireEvent.keyDown(rows[0]!, { key: "ArrowDown" });
    expect(rows[1]!.getAttribute("aria-selected")).toBe("true");
    expect(rows[0]!.getAttribute("aria-selected")).toBe("false");
  });
});
