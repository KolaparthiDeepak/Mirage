import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { ToastProvider } from "@/app/_ui";
import { CommandPalette } from "./CommandPalette";

const { push, toggleTheme } = vi.hoisted(() => ({ push: vi.fn(), toggleTheme: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/p/card-block-lost",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/app/_lib/theme", () => ({ toggleTheme }));

const fixture = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [
    {
      slug: "card-block-lost",
      name: "Card Block",
      basePath: "/acropolis",
      caseCount: 1,
      endpoints: [
        {
          key: "POST /x/GET_CARD/v1",
          method: "POST",
          path: "/x/GET_CARD/v1",
          runUrl: "",
          cases: [
            {
              id: "locate-happy",
              label: "locate happy path",
              isOpenApiGenerated: false,
              match: [],
              expected: { status: 200 },
              request: { method: "POST", url: "", headers: {}, body: "", curl: "curl $ORIGIN/x", notes: [] },
            },
          ],
        },
      ],
    },
  ],
};

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

afterEach(() => {
  push.mockClear();
  toggleTheme.mockClear();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
  cleanup();
});

function setup() {
  return render(
    <ViewModelProvider model={fixture as never}>
      <ToastProvider>
        <CommandPalette open onClose={vi.fn()} />
      </ToastProvider>
    </ViewModelProvider>,
  );
}

describe("CommandPalette", () => {
  it("lists 'Toggle theme' and runs it on click", () => {
    setup();
    const row = screen.getByText("Toggle theme").closest("button") as HTMLButtonElement;
    fireEvent.click(row);
    expect(toggleTheme).toHaveBeenCalled();
  });

  it("shows in-project commands and badges preview rows", () => {
    setup();
    expect(screen.getByText("Copy mock base URL")).toBeDefined();
    const newEp = screen.getByText("New endpoint").closest("button") as HTMLButtonElement;
    expect(within(newEp).getByText("Preview")).toBeDefined();
  });

  it("'Go to Traffic' navigates to /traffic and is not a preview row", () => {
    setup();
    const row = screen.getByText("Go to Traffic").closest("button") as HTMLButtonElement;
    expect(within(row).queryByText("Preview")).toBeNull();
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith("/traffic");
  });

  it("runs the highlighted command on ArrowDown + Enter", () => {
    setup();
    const input = screen.getByLabelText("Command or search");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // move off 'Toggle theme' to 'Go to Projects'
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/projects");
  });

  it("'Copy mock base URL' writes to the clipboard and toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup();
    fireEvent.click(screen.getByText("Copy mock base URL").closest("button")!);
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(await screen.findByText("Mock base URL copied")).toBeDefined();
  });

  it("shows inline search-result rows for a typed query", () => {
    setup();
    const input = screen.getByLabelText("Command or search");
    fireEvent.change(input, { target: { value: "card" } });
    expect(screen.getByText("Results")).toBeDefined();
    expect(screen.getByText("/card-block-lost")).toBeDefined();
  });

  it("filters commands by label and empties on no match", () => {
    setup();
    const input = screen.getByLabelText("Command or search");
    fireEvent.change(input, { target: { value: "cases" } });
    expect(screen.getByText("Open Cases")).toBeDefined();
    expect(screen.queryByText("Toggle theme")).toBeNull();

    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.queryByText("Open Cases")).toBeNull();
    expect(screen.getByText("No matches")).toBeDefined();
  });
});
