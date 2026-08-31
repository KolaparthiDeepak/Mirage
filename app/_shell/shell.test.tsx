import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { PreviewBadge } from "./PreviewBadge";

vi.mock("next/navigation", () => ({
  usePathname: () => "/p/card-block-lost/endpoints",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...p
  }: {
    href: unknown;
    children: React.ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...p}>
      {children}
    </a>
  ),
}));

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [
    { slug: "card-block-lost", name: "Card Block", endpoints: [], caseCount: 0 },
  ],
};

afterEach(() => cleanup());

describe("Sidebar", () => {
  it("shows the PROJECT group and renders not-yet-built routes as non-links", () => {
    render(
      <ViewModelProvider model={model as never}>
        <Sidebar />
      </ViewModelProvider>,
    );
    expect(screen.getByText("Cases")).toBeDefined();
    // Overview has a real route
    expect(screen.getByRole("link", { name: "Overview" })).toBeDefined();
    // Rules is still `soon` -> text present but no link
    expect(screen.getByText("Rules")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Rules" })).toBeNull();
    // workspace Traffic is live now (Phase 4)
    expect(screen.getByRole("link", { name: "Traffic" })).toBeDefined();
    // project Environments is live now (Phase 4.2)
    expect(screen.getByRole("link", { name: "Environments" })).toBeDefined();
  });

  it("renders the project Endpoints item as the active link on its route", () => {
    render(
      <ViewModelProvider model={model as never}>
        <Sidebar />
      </ViewModelProvider>,
    );
    // pathname is /p/card-block-lost/endpoints -> project Endpoints is live + current
    expect(
      screen.getByRole("link", { name: "Endpoints", current: "page" }),
    ).toBeDefined();
    // the WORKSPACE-level Endpoints stays `soon` (Phase 3) -> both texts present
    expect(screen.getAllByText("Endpoints").length).toBe(2);
  });
});

describe("ProjectSwitcher", () => {
  it("renders the current project's name", () => {
    render(
      <ViewModelProvider model={model as never}>
        <ProjectSwitcher />
      </ViewModelProvider>,
    );
    expect(screen.getByText("Card Block")).toBeDefined();
  });
});

describe("PreviewBadge", () => {
  it("renders the text Preview", () => {
    render(<PreviewBadge />);
    expect(screen.getByText("Preview")).toBeDefined();
  });
});

describe("TopBar", () => {
  it("renders the wordmark text 'Mirage'", () => {
    render(
      <ViewModelProvider model={model as never}>
        <TopBar />
      </ViewModelProvider>,
    );
    expect(screen.getByText("Mirage")).toBeDefined();
  });
});
