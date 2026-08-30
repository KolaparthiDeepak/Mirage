import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme, setTheme, toggleTheme } from "./theme";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  try {
    document.documentElement.removeAttribute("data-theme");
  } catch {
    /* jsdom */
  }
  try {
    localStorage.clear();
  } catch {
    /* jsdom */
  }
});

describe("theme", () => {
  it("defaults to obsidian", () => {
    expect(getTheme()).toBe("obsidian");
  });

  it("setTheme('paper') applies the data attribute and getTheme reflects it", () => {
    setTheme("paper");
    expect(getTheme()).toBe("paper");
    expect(document.documentElement.dataset.theme).toBe("paper");
  });

  it("persists the chosen theme to localStorage — both values", () => {
    setTheme("obsidian");
    expect(localStorage.getItem("mockservers-theme")).toBe("obsidian");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    setTheme("paper");
    expect(localStorage.getItem("mockservers-theme")).toBe("paper");
  });

  it("toggleTheme flips paper back to obsidian", () => {
    setTheme("paper");
    toggleTheme();
    expect(getTheme()).toBe("obsidian");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
