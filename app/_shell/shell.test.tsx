import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
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
  it("shows the PROJECT group inside a project and marks the active route", () => {
    render(
      <ViewModelProvider model={model as never}>
        <Sidebar />
      </ViewModelProvider>,
    );
    expect(screen.getByText("Cases")).toBeDefined();
    const active = screen.getByRole("link", { name: "Endpoints", current: "page" });
    expect(active).toBeDefined();
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
