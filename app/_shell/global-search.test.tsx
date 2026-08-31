import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import { GlobalSearch } from "./GlobalSearch";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/projects",
}));

const fixture = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [
    {
      slug: "card-block-lost",
      name: "Card Block",
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
              request: { method: "POST", url: "", headers: {}, body: "", curl: "", notes: [] },
            },
          ],
        },
      ],
    },
  ],
};

afterEach(() => {
  push.mockClear();
  cleanup();
});

function setup() {
  return render(
    <ViewModelProvider model={fixture as never}>
      <GlobalSearch />
    </ViewModelProvider>,
  );
}

describe("GlobalSearch", () => {
  it("shows a Projects group with the matching project", async () => {
    setup();
    const input = screen.getByLabelText("Search Mirage");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "card" } });

    expect(await screen.findByText("Projects")).toBeDefined();
    expect(screen.getAllByText("Card Block").length).toBeGreaterThan(0);
  });

  it("navigates to the encoded endpoint URL on Enter over the endpoint row", async () => {
    setup();
    const input = screen.getByLabelText("Search Mirage");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "get_card" } });

    await screen.findByText("Endpoints");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(push).toHaveBeenCalledWith(
      "/p/card-block-lost/endpoints?e=POST%20%2Fx%2FGET_CARD%2Fv1",
    );
  });

  it("clears the input on Escape", async () => {
    setup();
    const input = screen.getByLabelText("Search Mirage") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "card" } });
    await screen.findByText("Projects");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });
});
