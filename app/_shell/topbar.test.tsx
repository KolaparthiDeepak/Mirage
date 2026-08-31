import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

let mockTheme: "paper" | "obsidian" = "obsidian";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...p}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/_lib/theme", () => ({
  getTheme: () => mockTheme,
  toggleTheme: () => {
    mockTheme = mockTheme === "paper" ? "obsidian" : "paper";
  },
}));

import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { TopBar } from "./TopBar";

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [],
};

afterEach(() => {
  mockTheme = "obsidian";
  cleanup();
});

describe("TopBar theme toggle", () => {
  it("reflects the new theme in its aria-label after a click", () => {
    render(
      <ViewModelProvider model={model as never}>
        <TopBar />
      </ViewModelProvider>,
    );
    const btn = screen.getByLabelText("Switch to light theme");
    expect(btn.textContent).toBe("☾");
    fireEvent.click(btn);
    expect(screen.getByLabelText("Switch to dark theme").textContent).toBe("☀");
  });
});
