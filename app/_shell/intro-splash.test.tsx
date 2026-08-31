import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { IntroSplash } from "./IntroSplash";

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}


afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("IntroSplash", () => {
  it("renders the overlay with canvas when motion is allowed", () => {
    mockMatchMedia(false);
    render(<IntroSplash />);
    expect(document.querySelector("[data-intro]")).not.toBeNull();
    expect(document.querySelector("canvas")).not.toBeNull();
  });

  it("renders nothing under reduced motion", () => {
    mockMatchMedia(true);
    const { container } = render(<IntroSplash />);
    expect(container.firstChild).toBeNull();
    expect(document.querySelector("[data-intro]")).toBeNull();
  });

  it("replays the intro on each render when motion is allowed", () => {
    mockMatchMedia(false);
    const { unmount } = render(<IntroSplash />);
    expect(document.querySelector("[data-intro]")).not.toBeNull();
    unmount();
    cleanup();
    render(<IntroSplash />);
    expect(document.querySelector("[data-intro]")).not.toBeNull();
  });
});
