export type Theme = "paper" | "obsidian";

const KEY = "mirage-theme";
// Read once more under the pre-rename key so an existing user's choice survives
// the rename (plan 25). Drop this fallback once that release has aged out.
const LEGACY_KEY = "mockservers-theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "obsidian";
  try {
    const stored = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    return stored === "paper" ? "paper" : "obsidian";
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
