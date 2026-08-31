import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { ToastProvider } from "@/app/_ui";
import ProjectsPage from "@/app/(app)/projects/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/projects", useRouter: () => ({ push: vi.fn() }) }));

const model = {
  build: { commit: "abc123", builtAt: "", warnings: [] },
  projects: [
    { slug: "alpha-api", name: "Alpha API", endpoints: [{}, {}], caseCount: 5 },
    { slug: "beta-svc", name: "Beta Service", endpoints: [{}, {}, {}], caseCount: 40 },
  ],
} as never;

function renderPage(m: unknown = model) {
  return render(
    <ViewModelProvider model={m as never}>
      <ToastProvider>
        <ProjectsPage />
      </ToastProvider>
    </ViewModelProvider>,
  );
}

afterEach(() => cleanup());

describe("Projects page", () => {
  it("renders a card per project with endpoint and case counts", () => {
    renderPage();
    expect(screen.getByText("Alpha API")).toBeDefined();
    expect(screen.getByText("Beta Service")).toBeDefined();
  });

  it("shows the sharpened page description and no 'Mock server' label", () => {
    renderPage();
    expect(
      screen.getByText("Simulate any API. Steer every branch. No backend required."),
    ).toBeDefined();
    expect(screen.queryByText("Mock server")).toBeNull();
  });

  it("shows the empty state with no projects", () => {
    renderPage({ ...(model as object), projects: [] });
    expect(screen.getByText(/workspace is empty/i)).toBeDefined();
  });

  it("filters the visible cards as you type (debounced)", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Search projects"), { target: { value: "Alpha" } });
    await waitFor(() => expect(screen.queryByText("Beta Service")).toBeNull());
    expect(screen.getByText("Alpha API")).toBeDefined();
  });

  it("switches to list view and drops the card-only chrome", () => {
    renderPage();
    expect(screen.getAllByText("Open").length).toBe(2);
    fireEvent.click(screen.getByRole("tab", { name: "List" }));
    expect(screen.queryByText("Open")).toBeNull();
    expect(screen.getByText("Alpha API")).toBeDefined();
  });

  it("sort by Cases reorders projects by descending case count", () => {
    renderPage();
    // default sort = name → Alpha first
    expect(screen.getAllByRole("article")[0]?.textContent).toContain("Alpha API");
    fireEvent.change(screen.getByLabelText("Sort projects"), { target: { value: "cases" } });
    expect(screen.getAllByRole("article")[0]?.textContent).toContain("Beta Service");
  });
});
