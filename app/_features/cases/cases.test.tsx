import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { useState } from "react";
import type { CaseVM, EndpointVM } from "@/src/viewer/model";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { CaseList } from "./CaseList";
import { CaseRow } from "./CaseRow";
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

  it("clicking a case row shows its CaseDetail in the rail", () => {
    renderPage();
    expect(screen.queryByText("Expected status")).toBeNull();

    fireEvent.click(screen.getByText("c3").closest("[role=option]")!);

    expect(screen.getByText("Expected status")).toBeDefined();
    expect(screen.getByText("Expected body")).toBeDefined();
    // c3 expects a 404 — shown in the row and again in the detail rail.
    expect(screen.getAllByText("404").length).toBeGreaterThan(1);
  });
});

describe("CaseRow truncation", () => {
  it("renders a long case label and its status code without collision or throw", () => {
    const long = mk("locate-card-service-down-when-upstream-is-completely-unavailable", {
      match: [{ jsonPath: "$.request.headers.x-very-long-header-name", equals: "some-long-value" }],
      expected: { status: 500, body: null },
    });
    render(<CaseRow case_={long} />);
    expect(screen.getByText(long.label)).toBeDefined();
    expect(screen.getByText("500")).toBeDefined();
  });

  it("disables Duplicate/Delete without slug/method/path, but Edit still works (plan 03)", () => {
    const onSelect = vi.fn();
    render(<CaseRow case_={mk("c1")} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Case actions" }));
    expect(screen.getByText("Duplicate").closest("[aria-disabled]")).toBeTruthy();
    expect(screen.getByText("Delete").closest("[aria-disabled]")).toBeTruthy();
    // Clicking Edit closes the menu (Dropdown unmounts its items on select) —
    // exercised last, since it's not something to assert menu state against.
    fireEvent.click(screen.getByText("Edit"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("enables Duplicate/Delete once slug/method/path are supplied (plan 03)", () => {
    render(<CaseRow case_={mk("c1")} slug="demo" method="GET" path="/x" />);
    fireEvent.click(screen.getByRole("button", { name: "Case actions" }));
    expect(screen.getByText("Duplicate").closest("[aria-disabled]")).toBeNull();
    expect(screen.getByText("Delete").closest("[aria-disabled]")).toBeNull();
  });

  it(".label carries the ellipsis rule in the CSS module", () => {
    const css = readFileSync(
      join(process.cwd(), "app/_features/cases/cases.module.css"),
      "utf8",
    );
    const block = css.match(/\n\.label\s*\{[^}]*\}/)?.[0] ?? "";
    expect(block).toMatch(/text-overflow:\s*ellipsis/);
    expect(block).toMatch(/overflow:\s*hidden/);
  });
});

describe("CaseList keyboard nav", () => {
  function Harness() {
    const [sel, setSel] = useState<string | null>(null);
    return <CaseList cases={ep1.cases} selectedId={sel} onSelect={setSel} />;
  }

  it("makes the first row tabbable when nothing is selected (roving fallback)", () => {
    render(<Harness />);
    const rows = screen.getAllByRole("option");
    expect(rows[0]!.getAttribute("tabindex")).toBe("0");
    expect(rows[1]!.getAttribute("tabindex")).toBe("-1");
  });

  it("ArrowDown from the first row moves aria-selected", () => {
    render(<Harness />);
    const rows = screen.getAllByRole("option");
    fireEvent.keyDown(rows[0]!, { key: "ArrowDown" });
    expect(rows[1]!.getAttribute("aria-selected")).toBe("true");
    expect(rows[0]!.getAttribute("aria-selected")).toBe("false");
  });
});
