import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import ProjectLayout from "./layout";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/p/card-block-lost/cases",
  notFound,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) => (
    <a href={href}>{children as never}</a>
  ),
}));

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [
    { slug: "card-block-lost", name: "Card Block (Lost Card)", endpoints: [], caseCount: 0 },
  ],
} as never;

// A synchronously-fulfilled thenable so `use(params)` resolves without Suspense.
function resolvedParams(slug: string) {
  const p = Promise.resolve({ slug }) as Promise<{ slug: string }> & {
    status: string;
    value: { slug: string };
  };
  p.status = "fulfilled";
  p.value = { slug };
  return p;
}

function renderLayout(slug: string) {
  return render(
    <ViewModelProvider model={model}>
      <ProjectLayout params={resolvedParams(slug)}>x</ProjectLayout>
    </ViewModelProvider>,
  );
}

afterEach(() => {
  cleanup();
  notFound.mockClear();
});

describe("ProjectLayout breadcrumbs", () => {
  it("shows the project name and the current section", () => {
    renderLayout("card-block-lost");
    expect(screen.getByText("Card Block (Lost Card)")).toBeDefined();
    expect(screen.getByText("Cases")).toBeDefined();
  });

  it("calls notFound for an unknown slug", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderLayout("no-such-project")).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
