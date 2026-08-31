import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ProjectConfigProvider } from "@/app/_lib/project-config-context";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { ToastProvider } from "@/app/_ui";
import type { ProjectVM } from "@/src/viewer/model";
import { SettingsTabs } from "./SettingsTabs";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace }),
  usePathname: () => "/p/card-block-lost/settings",
}));

afterEach(() => cleanup());

const proj: ProjectVM = {
  slug: "card-block-lost",
  name: "Card Block (Lost Card)",
  basePath: "/commands",
  endpoints: [],
  caseCount: 0,
};

const cfg = {
  name: "Card Block (Lost Card)",
  basePath: "/commands",
  defaults: { delayMs: 0, cors: true },
  hasOpenApi: true,
};

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [proj],
};

function renderTabs() {
  return render(
    <ProjectConfigProvider configs={{ "card-block-lost": cfg }}>
      <ViewModelProvider model={model as never}>
        <ToastProvider>
          <SettingsTabs slug="card-block-lost" project={proj} config={cfg} />
        </ToastProvider>
      </ViewModelProvider>
    </ProjectConfigProvider>,
  );
}

describe("SettingsTabs", () => {
  it("pre-fills the General tab from the real config", () => {
    renderTabs();
    expect(screen.getByDisplayValue("Card Block (Lost Card)")).toBeDefined();
    expect(screen.getByDisplayValue("/commands")).toBeDefined();
  });

  it("emits project.yaml (edited keys only, no defaults block)", () => {
    renderTabs();
    fireEvent.click(
      screen.getByRole("button", { name: "Generate project.yaml" }),
    );
    const pre = screen.getByText(/name: "Card Block \(Lost Card\)"/);
    expect(pre.textContent).toContain("slug: card-block-lost");
    expect(pre.textContent).not.toContain("defaults");
  });

  it("shows read-only server facts", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Server" }));
    expect(screen.getByText("enabled")).toBeDefined();
    expect(screen.getByText("0 ms")).toBeDefined();
  });

  it("opens an explain-only modal in the Danger Zone — deletes nothing", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Danger Zone" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    expect(
      screen.getByText(/this UI can't delete anything/i),
    ).toBeDefined();
  });
});
