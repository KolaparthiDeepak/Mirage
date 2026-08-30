export type Theme = "paper" | "obsidian";

const KEY = "mockservers-theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "obsidian";
  return document.documentElement.dataset.theme === "paper" ? "paper" : "obsidian";
}

export function setTheme(t: Theme): void {
  if (t === "paper") {
    document.documentElement.dataset.theme = "paper";
    try {
      localStorage.setItem(KEY, "paper");
    } catch {
      /* private mode / storage disabled — the toggle still works for this session */
    }
  } else {
    delete document.documentElement.dataset.theme;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* private mode / storage disabled */
    }
  }
}

export function toggleTheme(): void {
  setTheme(getTheme() === "paper" ? "obsidian" : "paper");
}
