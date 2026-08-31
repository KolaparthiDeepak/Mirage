import { useEffect } from "react";

export type Combo = string; // "mod+k", "mod+shift+c", "mod+p", "mod+e", "mod+s", "esc", "mod+enter"
export interface ShortcutMap {
  [combo: Combo]: () => void;
}

type ComboEvent = Pick<KeyboardEvent, "key"> & {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

export function matchCombo(e: ComboEvent): Combo | null {
  const mod = !!(e.metaKey || e.ctrlKey);
  let key = e.key.toLowerCase();
  if (key === "escape") key = "esc";
  else if (key === "enter") key = "enter";

  if (key === "esc") return "esc";
  // Alt as the only modifier is a distinct combo space (⌥-chars, readline) — the
  // !mod guard below already drops it; kept explicit so intent survives edits.
  if (e.altKey && !mod) return null;
  if (!mod) return null;

  const parts: string[] = ["mod"];
  if (e.shiftKey) parts.push("shift");
  parts.push(key);
  return parts.join("+");
}

export const ALWAYS_ALLOWED: Combo[] = ["mod+enter", "esc", "mod+k"];

export function useShortcuts(map: ShortcutMap): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const combo = matchCombo(e);
      if (!combo) return;
      if (!(combo in map)) return;

      const el = document.activeElement;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as HTMLElement).isContentEditable);
      if (typing && !ALWAYS_ALLOWED.includes(combo)) return;

      if (combo !== "esc") e.preventDefault();
      map[combo]!();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}
