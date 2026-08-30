export type Theme = "paper" | "obsidian";

const KEY = "mockservers-theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "obsidian";
  try {
    return localStorage.getItem(KEY) === "paper" ? "paper" : "obsidian";
  } catch {
    return document.documentElement.dataset.theme === "paper" ? "paper" : "obsidian";
  }
}

export function setTheme(t: Theme): void {
  if (t === "paper") document.documentElement.dataset.theme = "paper";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode / storage disabled — the toggle still works for this session */
  }
}

export function toggleTheme(): void {
  setTheme(getTheme() === "paper" ? "obsidian" : "paper");
}
