import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { PreviewProvider } from "@/app/_lib/preview-store";
import { ToastProvider } from "@/app/_ui";
import { AppShell } from "./AppShell";

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

const model = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [{ slug: "card-block-lost", name: "Card Block", endpoints: [], caseCount: 0 }],
};

afterEach(() => cleanup());

function renderShell() {
  return render(
    <ViewModelProvider model={model as never}>
      <PreviewProvider>
        <ToastProvider>
          <AppShell>
            <div>child</div>
          </AppShell>
        </ToastProvider>
      </PreviewProvider>
    </ViewModelProvider>,
  );
}

describe("AppShell", () => {
  it("opens the command palette on ⌘K with focus on its input", () => {
    renderShell();

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("Command or search");
    expect(input).toBeDefined();
    expect(document.activeElement).toBe(input);
  });

  it("⌘K opens the palette even while another input is focused", () => {
    renderShell();

    const search = screen.getByLabelText("Search Mirage") as HTMLInputElement;
    search.focus();
    expect(document.activeElement).toBe(search);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("keeps the mobile navigation hamburger in the DOM (CSS-hidden at desktop)", () => {
    renderShell();
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeDefined();
  });

  it("renders a skip link as the first href, targeting #main-content on <main>", () => {
    const { container } = renderShell();
    const firstLink = container.querySelector("a[href]")!;
    expect(firstLink.getAttribute("href")).toBe("#main-content");
    expect(firstLink.textContent).toBe("Skip to content");
    const main = container.querySelector("main")!;
    expect(main.id).toBe("main-content");
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("does not hijack ⌘P / ⌘S / ⌘E — they pass through to the browser", () => {
    renderShell();
    for (const key of ["p", "s", "e"]) {
      // fireEvent returns false when a listener called preventDefault
      const notPrevented = fireEvent.keyDown(window, { key, metaKey: true });
      expect(notPrevented).toBe(true);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("⌘K toggles the palette closed again", () => {
    renderShell();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
