import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
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

afterEach(() => {
  push.mockClear();
  toggleTheme.mockClear();
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
