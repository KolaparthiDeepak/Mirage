import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ViewModelProvider } from "@/app/_lib/view-model-context";
import * as searchModule from "@/app/_lib/search";
import { GlobalSearch } from "./GlobalSearch";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/projects",
}));

const fixture = {
  build: { commit: "x", builtAt: "", warnings: [] },
  projects: [
    { slug: "card-block-lost", name: "Card Block", caseCount: 0, endpoints: [] },
  ],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
});

describe("GlobalSearch — searchViewModel is memoized + debounced", () => {
  it("runs the search scan at most once per debounce window, not once per keystroke", () => {
    const spy = vi.spyOn(searchModule, "searchViewModel");
    render(
      <ViewModelProvider model={fixture as never}>
        <GlobalSearch />
      </ViewModelProvider>,
    );
    const input = screen.getByLabelText("Search Mirage");
    fireEvent.focus(input);

    const before = spy.mock.calls.length;
    for (const value of ["c", "ca", "car", "card"]) {
      fireEvent.change(input, { target: { value } });
    }
    // No debounce elapsed yet — the memoized value hasn't changed.
    expect(spy.mock.calls.length).toBe(before);

    act(() => vi.advanceTimersByTime(200));
    expect(spy.mock.calls.length).toBe(before + 1);
    expect(spy).toHaveBeenLastCalledWith(fixture, "card");
  });
});
