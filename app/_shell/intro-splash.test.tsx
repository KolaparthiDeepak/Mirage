import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
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

beforeEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    /* noop */
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("IntroSplash", () => {
  it("shows the overlay once on a fresh session and records the seen flag", () => {
    mockMatchMedia(false);
    render(<IntroSplash />);
    expect(document.querySelector("[data-intro]")).not.toBeNull();
    expect(document.querySelector("canvas")).not.toBeNull();
    expect(sessionStorage.getItem("mirage-intro-seen")).toBe("1");
  });

  it("renders nothing when the intro was already seen this session", () => {
    mockMatchMedia(false);
    sessionStorage.setItem("mirage-intro-seen", "1");
    const { container } = render(<IntroSplash />);
    expect(container.firstChild).toBeNull();
    expect(document.querySelector("[data-intro]")).toBeNull();
  });

  it("skips the animation but still sets the seen flag under reduced motion", () => {
    mockMatchMedia(true);
    render(<IntroSplash />);
    expect(document.querySelector("[data-intro]")).toBeNull();
    expect(sessionStorage.getItem("mirage-intro-seen")).toBe("1");
  });
});
