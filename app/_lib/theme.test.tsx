import { afterEach, describe, expect, it } from "vitest";
import { getTheme, setTheme, toggleTheme } from "./theme";

afterEach(() => {
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

  it("toggleTheme flips paper back to obsidian", () => {
    setTheme("paper");
    toggleTheme();
    expect(getTheme()).toBe("obsidian");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
