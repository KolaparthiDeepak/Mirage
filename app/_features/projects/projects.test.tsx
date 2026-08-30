import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import ProjectsPage from "@/app/(app)/projects/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/projects", useRouter: () => ({ push: vi.fn() }) }));

const model = { build: { commit: "abc123", builtAt: "", warnings: [] }, projects: [
  { slug: "card-block-lost", name: "Card Block (Lost Card)", endpoints: [{}, {}, {}], caseCount: 35 },
] } as never;

describe("Projects page", () => {
  it("renders a card per project with endpoint and case counts", () => {
    render(<ViewModelProvider model={model}><ProjectsPage /></ViewModelProvider>);
    expect(screen.getByText("Card Block (Lost Card)")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("35")).toBeDefined();
    expect(screen.getByRole("link", { name: /card-block-lost/i })).toBeDefined();
  });
  it("shows the empty state with no projects", () => {
    render(<ViewModelProvider model={{ ...(model as object), projects: [] } as never}><ProjectsPage /></ViewModelProvider>);
    expect(screen.getByText(/workspace is empty/i)).toBeDefined();
  });
});
