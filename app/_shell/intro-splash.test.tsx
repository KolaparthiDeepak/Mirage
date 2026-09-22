import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { IntroSplash, REPLAY_INTRO_EVENT } from "./IntroSplash";

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

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("IntroSplash", () => {
  it("renders the overlay with canvas on a first visit", () => {
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

  it("does not replay on a later visit once seen", () => {
    mockMatchMedia(false);
    store.set("mirage-intro-seen", "1");
    const { container } = render(<IntroSplash />);
    expect(container.firstChild).toBeNull();
  });

  it("exits immediately on a click, marking it seen", async () => {
    mockMatchMedia(false);
    render(<IntroSplash />);
    expect(document.querySelector("[data-intro]")).not.toBeNull();

    fireEvent.pointerDown(window);

    await waitFor(() => expect(document.querySelector("[data-intro]")).toBeNull());
    expect(store.get("mirage-intro-seen")).toBe("1");
  });

  it("exits immediately on a keypress", async () => {
    mockMatchMedia(false);
    render(<IntroSplash />);
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(document.querySelector("[data-intro]")).toBeNull());
  });

  it("replays on the replay event even when already seen", () => {
    mockMatchMedia(false);
    store.set("mirage-intro-seen", "1");
    render(<IntroSplash />);
    expect(document.querySelector("[data-intro]")).toBeNull();

    fireEvent(window, new Event(REPLAY_INTRO_EVENT));

    expect(document.querySelector("[data-intro]")).not.toBeNull();
  });
});
